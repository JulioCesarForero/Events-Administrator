from uuid import UUID
from urllib.parse import unquote, urlparse
import unicodedata

from fastapi import APIRouter, HTTPException
from pydantic import Field

from shared.api.schemas import CamelModel, CamelOrmModel
from sqlalchemy import select

from domain.error_codes import INVALID_PAYLOAD
from domain.exceptions import ValidationError
from infrastructure.persistence.models import StudentImportBatch, StudentRecord
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access

REQUIRED_IMPORT_COLUMNS = {"codigo_unico", "apellidos", "nombres"}

router = APIRouter(tags=["import"])


class StudentRow(CamelModel):
    student_code: str = Field(max_length=128)
    first_name: str = Field(max_length=200)
    last_name: str = Field(max_length=200)


class ImportCreateRequest(CamelModel):
    file_name: str = Field(max_length=500)
    file_url: str | None = None
    object_key: str | None = None
    bucket: str | None = None
    storage_path: str | None = None
    expected_columns: list[str] | None = None
    rows: list[StudentRow] | None = None


class ImportCreateResponse(CamelModel):
    batch_id: UUID
    status: str


@router.post("/events/{event_id}/student-imports", response_model=ImportCreateResponse)
def create_import(
    event_id: UUID,
    body: ImportCreateRequest,
    db: DbSession,
    staff: StaffUserDep,
) -> ImportCreateResponse:
    import csv
    import io
    from google.cloud import storage
    from config.settings import settings

    def _normalize_header(value: str) -> str:
        raw = (value or "").replace("\ufeff", "").strip().lower()
        raw = unicodedata.normalize("NFKD", raw)
        raw = "".join(ch for ch in raw if not unicodedata.combining(ch))
        raw = raw.replace(" ", "_").replace("-", "_")
        return raw

    ensure_event_staff_access(db, staff, event_id)
    
    # Pre-validate columns if provided in the request
    if body.expected_columns is not None:
        provided = {c.strip().lower() for c in body.expected_columns}
        if provided != REQUIRED_IMPORT_COLUMNS:
            raise ValidationError(
                f"Import file must contain exactly columns: {sorted(REQUIRED_IMPORT_COLUMNS)}",
                code=INVALID_PAYLOAD,
            )

    batch = StudentImportBatch(
        event_id=event_id,
        uploaded_by_user_id=staff.id,
        source_file_name=body.file_name,
        status="PROCESSING",
    )
    db.add(batch)
    db.flush()

    rows_to_process = body.rows or []

    # If no rows provided but file_url is present, download and parse from GCS
    if not rows_to_process and (body.file_url or body.object_key or body.storage_path):
        try:
            object_key = body.object_key
            bucket_name = body.bucket or settings.gcs_bucket_name

            if body.storage_path and body.storage_path.startswith("gs://"):
                _, path_part = body.storage_path.split("gs://", 1)
                bucket_name, object_key = path_part.split("/", 1)
            elif not object_key:
                parsed = urlparse(body.file_url)
                if parsed.netloc.endswith("storage.googleapis.com"):
                    raw_path = parsed.path.lstrip("/")
                    if "/" not in raw_path:
                        raise ValueError("Invalid storage.googleapis.com URL format")
                    bucket_name, object_key = raw_path.split("/", 1)
                else:
                    marker = f"{bucket_name}/"
                    if marker not in body.file_url:
                        raise ValueError("Invalid file_url for this bucket")
                    object_key = body.file_url.split(marker, 1)[1].split("?", 1)[0]

            if not object_key:
                raise ValueError("Missing object key in upload reference")
            object_key = unquote(object_key)

            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(object_key)
            
            content = blob.download_as_text()
            f = io.StringIO(content)
            
            # Detect delimiter (fallback to ';' or ',').
            sample = content[:2048]
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;")
                delimiter = dialect.delimiter
            except Exception:
                first_line = content.splitlines()[0] if content else ""
                delimiter = ";" if ";" in first_line else ","
            reader = csv.DictReader(f, delimiter=delimiter)
            
            # Normalize headers (BOM, accents, spaces).
            reader.fieldnames = [_normalize_header(fn) for fn in (reader.fieldnames or [])]
            expected = {_normalize_header(c) for c in REQUIRED_IMPORT_COLUMNS}
            present = set(reader.fieldnames or [])
            if not expected.issubset(present):
                raise ValueError(
                    "CSV headers must include codigo_unico, apellidos, nombres"
                )
            
            for row in reader:
                student_code = (row.get("codigo_unico") or row.get("codigo") or "").strip()
                first_name = (row.get("nombres") or row.get("nombre") or "").strip()
                last_name = (row.get("apellidos") or row.get("apellido") or "").strip()
                if not student_code:
                    continue
                rows_to_process.append(
                    StudentRow(
                        student_code=student_code,
                        first_name=first_name,
                        last_name=last_name,
                    )
                )
        except Exception as e:
            batch.status = "FAILED"
            db.flush()
            raise HTTPException(status_code=400, detail=f"Error processing CSV from GCS: {str(e)}")

    total = len(rows_to_process)
    imported = 0
    
    if rows_to_process:
        for row in rows_to_process:
            if not row.student_code:
                continue
            db.add(
                StudentRecord(
                    import_batch_id=batch.id,
                    event_id=event_id,
                    student_code=row.student_code,
                    first_name=row.first_name,
                    last_name=row.last_name,
                )
            )
            imported += 1
        
        batch.total_rows = total
        batch.imported_rows = imported
        batch.failed_rows = total - imported
        batch.status = "COMPLETED"
    else:
        batch.status = "FAILED"
        db.flush()
        raise HTTPException(
            status_code=400,
            detail=(
                "No valid student rows found in CSV. "
                "Expected headers: codigo_unico, apellidos, nombres"
            ),
        )
        
    db.flush()
    return ImportCreateResponse(batch_id=batch.id, status=batch.status)


class ImportStatusOut(CamelOrmModel):
    batch_id: UUID = Field(validation_alias="id")
    status: str
    total_rows: int
    imported_rows: int
    failed_rows: int


@router.get("/events/{event_id}/student-imports/{batch_id}", response_model=ImportStatusOut)
def get_import_status(
    event_id: UUID,
    batch_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> StudentImportBatch:
    ensure_event_staff_access(db, staff, event_id)
    b = db.get(StudentImportBatch, batch_id)
    if b is None or b.event_id != event_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Batch not found")
    return b
