"""Signed URL generation for object storage (MVP: local file paths, production: S3/MinIO)."""

import hashlib
import hmac
import time
from urllib.parse import urlencode

from config.settings import settings


def generate_upload_url(*, bucket: str, object_key: str, expires_in: int = 3600) -> str:
    """Generate a signed upload URL.

    In production, replace with actual S3/MinIO presigned URL generation.
    For the MVP, generates a token-signed URL pointing to the backend upload
    endpoint that can be validated on receipt.
    """
    expiry = int(time.time()) + expires_in
    payload = f"{bucket}/{object_key}:{expiry}"
    sig = hmac.new(
        settings.jwt_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:32]
    params = urlencode({
        "bucket": bucket,
        "key": object_key,
        "expires": expiry,
        "sig": sig,
    })
    return f"/v1/storage/upload?{params}"


def verify_upload_signature(bucket: str, key: str, expires: int, sig: str) -> bool:
    if int(time.time()) > expires:
        return False
    payload = f"{bucket}/{key}:{expires}"
    expected = hmac.new(
        settings.jwt_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:32]
    return hmac.compare_digest(sig, expected)
