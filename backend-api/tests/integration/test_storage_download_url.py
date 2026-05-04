from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient


def test_storage_download_url_with_storage_path() -> None:
    from app.main import app

    client = TestClient(app)
    with (
        patch("shared.api.storage_router.decode_token", return_value={"sub": "u1"}),
        patch(
            "shared.api.storage_router.generate_download_url",
            return_value="https://signed.example.com/file",
        ),
    ):
        response = client.post(
            "/v1/storage/download-url",
            headers={"Authorization": "Bearer fake-token"},
            json={"storagePath": "gs://event_bucket_evidence/evidences/test_file.png"},
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["downloadUrl"].startswith("https://signed.example.com")
    assert isinstance(body["expiresIn"], int)


def test_storage_download_url_requires_auth() -> None:
    from app.main import app

    client = TestClient(app)
    response = client.post(
        "/v1/storage/download-url",
        json={"storagePath": "gs://event_bucket_evidence/evidences/test_file.png"},
    )
    assert response.status_code == 401
