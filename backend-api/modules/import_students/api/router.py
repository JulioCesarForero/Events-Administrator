from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from infrastructure.persistence.models import StudentImportBatch, StudentRecord
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access

router = APIRouter(tags=["import"])


class StudentRow(BaseModel):
    student_code: str = Field(max_length=128)
    first_name: str = Field(max_length=200)
    last_name: str = Field(max_length=200)


class ImportCreateRequest(BaseModel):
    file_name: str = Field(max_length=500)
    file_url: str | None = None
    rows: list[StudentRow] | None = None


class ImportCreateResponse(BaseModel):
    batch_id: UUID
    status: str


@router.post("/events/{event_id}/student-imports", response_model=ImportCreateResponse)
def create_import(
    event_id: UUID,
    body: ImportCreateRequest,
    db: DbSession,
    staff: StaffUserDep,
) -> ImportCreateResponse:
    ensure_event_staff_access(db, staff, event_id)
    batch = StudentImportBatch(
        event_id=event_id,
        uploaded_by_user_id=staff.id,
        source_file_name=body.file_name,
        status="PROCESSING",
    )
    db.add(batch)
    db.flush()
    total = 0
    imported = 0
    if body.rows:
        total = len(body.rows)
        for row in body.rows:
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
        batch.failed_rows = 0
        batch.status = "COMPLETED"
    else:
        batch.status = "PENDING"
    db.flush()
    return ImportCreateResponse(batch_id=batch.id, status=batch.status)


class ImportStatusOut(BaseModel):
    batch_id: UUID
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
