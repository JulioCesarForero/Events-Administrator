from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import Field, model_validator

from config.settings import settings
from domain.exceptions import ValidationError
from infrastructure.security.jwt_tokens import decode_token
from infrastructure.storage.signed_urls import (
    build_object_ref,
    generate_download_url,
    generate_upload_url,
    validate_upload_constraints,
)
from shared.api.schemas import CamelModel

router = APIRouter(prefix="/storage", tags=["storage"])

security_bearer = HTTPBearer(auto_error=False)


def verify_any_token(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)],
) -> dict:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        return decode_token(creds.credentials, settings.jwt_staff_audience)
    except jwt.PyJWTError:
        pass
    try:
        return decode_token(creds.credentials, settings.jwt_buyer_audience)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


class UploadUrlRequest(CamelModel):
    filename: str = Field(max_length=500)
    content_type: str = Field(default="application/octet-stream", max_length=128)
    purpose: str = Field(default="general", max_length=32)
    size_bytes: int | None = Field(default=None, ge=0)
    tenant_id: str | None = None
    event_id: str | None = None
    payment_id: str | None = None
    layout_id: str | None = None


class UploadUrlResponse(CamelModel):
    upload_url: str
    file_url: str
    object_key: str
    bucket: str
    storage_path: str
    expires_in: int


@router.post("/upload-url", response_model=UploadUrlResponse)
def get_upload_url(
    body: UploadUrlRequest, user_payload: dict = Depends(verify_any_token)
) -> UploadUrlResponse:
    """
    Get a signed URL to upload a file directly to GCS.
    The object key is automatically structured based on the purpose and user.
    """
    try:
        validate_upload_constraints(
            purpose=body.purpose,
            content_type=body.content_type,
            size_bytes=body.size_bytes,
        )
        object_ref = build_object_ref(
            purpose=body.purpose,
            filename=body.filename,
            tenant_id=body.tenant_id,
            event_id=body.event_id,
            payment_id=body.payment_id,
            layout_id=body.layout_id,
        )
        upload_url = generate_upload_url(
            bucket=object_ref.bucket,
            object_key=object_ref.object_key,
            content_type=body.content_type,
        )

        # Legacy compatibility field for existing clients.
        file_url = upload_url.split("?")[0]

        return UploadUrlResponse(
            upload_url=upload_url,
            file_url=file_url,
            object_key=object_ref.object_key,
            bucket=object_ref.bucket,
            storage_path=object_ref.storage_path,
            expires_in=settings.gcs_upload_url_ttl_seconds,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate upload URL: {str(e)}")


class DownloadUrlRequest(CamelModel):
    bucket: str | None = None
    object_key: str | None = None
    storage_path: str | None = None

    @model_validator(mode="after")
    def _validate_ref(self):
        if not self.storage_path and not (self.bucket and self.object_key):
            raise ValueError("Provide storagePath or bucket+objectKey")
        return self


class DownloadUrlResponse(CamelModel):
    download_url: str
    expires_in: int


@router.post("/download-url", response_model=DownloadUrlResponse)
def get_download_url(
    body: DownloadUrlRequest,
    user_payload: dict = Depends(verify_any_token),
) -> DownloadUrlResponse:
    try:
        if body.storage_path:
            if not body.storage_path.startswith("gs://"):
                raise HTTPException(status_code=400, detail="Invalid storagePath")
            _, path_part = body.storage_path.split("gs://", 1)
            bucket, object_key = path_part.split("/", 1)
        else:
            bucket = body.bucket or settings.gcs_bucket_name
            object_key = body.object_key or ""
        download_url = generate_download_url(bucket=bucket, object_key=object_key)
        return DownloadUrlResponse(
            download_url=download_url,
            expires_in=settings.gcs_download_url_ttl_seconds,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate download URL: {str(e)}")
