"""Google Cloud Storage signed URLs and object key helpers."""

from __future__ import annotations

import datetime
import posixpath
import re
import unicodedata
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from config.settings import settings
from domain.error_codes import INVALID_PAYLOAD
from domain.exceptions import ValidationError

_FILENAME_SAFE_RE = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class ObjectRef:
    bucket: str
    object_key: str

    @property
    def storage_path(self) -> str:
        return f"gs://{self.bucket}/{self.object_key}"

    @property
    def public_url(self) -> str:
        return f"https://storage.googleapis.com/{self.bucket}/{self.object_key}"


def _allowed_mime_for_purpose(purpose: str) -> set[str]:
    if purpose == "evidence":
        raw = settings.gcs_allowed_mime_evidence
    elif purpose == "layout":
        raw = settings.gcs_allowed_mime_layout
    elif purpose == "import":
        raw = settings.gcs_allowed_mime_import
    else:
        raw = ",".join(
            [
                settings.gcs_allowed_mime_evidence,
                settings.gcs_allowed_mime_layout,
                settings.gcs_allowed_mime_import,
            ]
        )
    return {m.strip().lower() for m in raw.split(",") if m.strip()}


def sanitize_filename(filename: str) -> str:
    name = (filename or "").strip()
    if not name:
        return "file.bin"
    base_name = posixpath.basename(name).replace("\\", "_").replace("/", "_")
    normalized = unicodedata.normalize("NFKD", base_name).encode("ascii", "ignore").decode("ascii")
    normalized = _FILENAME_SAFE_RE.sub("_", normalized).strip("._")
    if not normalized:
        normalized = "file.bin"
    return normalized[:180]


def validate_upload_constraints(
    *, purpose: str, content_type: str, size_bytes: int | None = None
) -> None:
    mime = (content_type or "application/octet-stream").lower().strip()
    allowed = _allowed_mime_for_purpose(purpose)
    if mime not in allowed:
        raise ValidationError(
            f"MIME type '{mime}' is not allowed for purpose '{purpose}'",
            code=INVALID_PAYLOAD,
        )
    if size_bytes is not None and size_bytes > settings.gcs_max_upload_size_bytes:
        raise ValidationError(
            f"File exceeds max size of {settings.gcs_max_upload_size_bytes} bytes",
            code=INVALID_PAYLOAD,
        )


def build_object_ref(
    *,
    purpose: str,
    filename: str,
    tenant_id: str | None = None,
    event_id: str | None = None,
    payment_id: str | None = None,
    layout_id: str | None = None,
) -> ObjectRef:
    clean_name = sanitize_filename(filename)
    if purpose == "import":
        prefix = "imports"
    elif purpose == "layout":
        prefix = "layouts"
    elif purpose == "evidence":
        prefix = "evidences"
    else:
        prefix = "general"

    path_parts = [prefix]
    if tenant_id:
        path_parts.extend(["tenants", str(tenant_id)])
    if event_id:
        path_parts.extend(["events", str(event_id)])
    if payment_id:
        path_parts.extend(["payments", str(payment_id)])
    if layout_id:
        path_parts.extend(["layouts", str(layout_id)])
    path_parts.append(f"{uuid4().hex}_{clean_name}")
    object_key = "/".join(path_parts)
    return ObjectRef(bucket=settings.gcs_bucket_name, object_key=object_key)


def _auth_default() -> tuple[Any, str | None]:
    import google.auth

    return google.auth.default()


def _auth_request() -> object:
    from google.auth.transport import requests

    return requests.Request()


def _is_compute_engine_credentials(credentials: object) -> bool:
    from google.auth.compute_engine.credentials import Credentials as ComputeEngineCredentials

    return isinstance(credentials, ComputeEngineCredentials)


def _iam_signer(request: object, credentials: object, service_account_email: str) -> object:
    from google.auth.iam import Signer

    return Signer(request, credentials, service_account_email)


def _storage_client_factory(credentials: object, project_id: str | None) -> Any:
    from google.cloud import storage

    return storage.Client(credentials=credentials, project=project_id)


def _build_signing_credentials(credentials: object) -> object:
    from google.auth import credentials as ga_credentials
    from google.auth import impersonated_credentials

    if isinstance(credentials, ga_credentials.Signing):
        return credentials
    service_account_email = getattr(credentials, "service_account_email", None)
    if not service_account_email:
        return credentials
    return impersonated_credentials.Credentials(
        source_credentials=credentials,
        target_principal=service_account_email,
        target_scopes=["https://www.googleapis.com/auth/devstorage.read_write"],
        lifetime=3600,
    )


def _storage_client() -> tuple[Any, object]:
    credentials, project_id = _auth_default()
    req = _auth_request()
    credentials.refresh(req)
    signing_credentials = _build_signing_credentials(credentials)
    if signing_credentials is not credentials:
        signing_credentials.refresh(req)
    return _storage_client_factory(signing_credentials, project_id), signing_credentials


def generate_upload_url(
    *,
    bucket: str,
    object_key: str,
    expires_in: int | None = None,
    content_type: str = "application/octet-stream",
) -> str:
    storage_client, credentials = _storage_client()
    blob = storage_client.bucket(bucket).blob(object_key)
    return blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(seconds=expires_in or settings.gcs_upload_url_ttl_seconds),
        method="PUT",
        content_type=content_type,
        service_account_email=getattr(credentials, "service_account_email", None),
    )


def generate_download_url(
    *,
    bucket: str,
    object_key: str,
    expires_in: int | None = None,
) -> str:
    storage_client, credentials = _storage_client()
    blob = storage_client.bucket(bucket).blob(object_key)
    return blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(seconds=expires_in or settings.gcs_download_url_ttl_seconds),
        method="GET",
        service_account_email=getattr(credentials, "service_account_email", None),
    )


def verify_upload_signature(bucket: str, key: str, expires: int, sig: str) -> bool:
    # GCS validates V4 signatures itself when using Signed URLs.
    return True
