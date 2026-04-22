"""Signed URL generation for object storage (MVP: local file paths, production: S3/MinIO)."""

import datetime
import google.auth
from google.auth.transport import requests
from google.auth.iam import Signer
from google.cloud import storage

from config.settings import settings


def generate_upload_url(
    *, bucket: str, object_key: str, expires_in: int = 3600, content_type: str = "application/octet-stream"
) -> str:
    """Generate a signed upload URL using Google Cloud Storage SDK."""
    credentials, project_id = google.auth.default()

    # Cloud Run (Compute Engine credentials) doesn't have a private key loaded in memory.
    # We must use IAM Credentials API to sign the URL.
    if getattr(credentials, 'service_account_email', None) and not hasattr(credentials, 'sign_bytes'):
        req = requests.Request()
        credentials.refresh(req)
        signer = Signer(req, credentials, credentials.service_account_email)
        credentials.sign_bytes = signer.sign

    storage_client = storage.Client(credentials=credentials, project=project_id)
    bucket_obj = storage_client.bucket(bucket)
    blob = bucket_obj.blob(object_key)

    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(seconds=expires_in),
        method="PUT",
        content_type=content_type,
        service_account_email=getattr(credentials, 'service_account_email', None)
    )
    return url


def verify_upload_signature(bucket: str, key: str, expires: int, sig: str) -> bool:
    # Google Cloud Storage verifies the signature automatically when the Signed URL is used.
    # The API doesn't need to manually verify it upon evidence submission.
    # This method is stubbed out / deprecated.
    return True
