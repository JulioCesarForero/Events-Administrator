from __future__ import annotations

from unittest.mock import Mock

import pytest

from domain.exceptions import ValidationError
from infrastructure.storage import signed_urls
from infrastructure.storage.signed_urls import (
    _storage_client,
    sanitize_filename,
    validate_upload_constraints,
)


def test_sanitize_filename_removes_path_and_special_chars() -> None:
    raw = r"..\unsafe//áé file?.pdf"
    cleaned = sanitize_filename(raw)
    assert "/" not in cleaned
    assert "\\" not in cleaned
    assert " " not in cleaned
    assert cleaned.endswith(".pdf")


def test_validate_upload_constraints_rejects_invalid_mime() -> None:
    with pytest.raises(ValidationError):
        validate_upload_constraints(
            purpose="evidence",
            content_type="application/javascript",
            size_bytes=1024,
        )


def test_validate_upload_constraints_rejects_excessive_size() -> None:
    with pytest.raises(ValidationError):
        validate_upload_constraints(
            purpose="import",
            content_type="text/csv",
            size_bytes=99_999_999,
        )


def test_storage_client_uses_impersonated_signing_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeComputeCredentials:
        def __init__(self) -> None:
            self.service_account_email = "svc@example.iam.gserviceaccount.com"
            self.refresh_calls = 0

        def refresh(self, _request: object) -> None:
            self.refresh_calls += 1

    fake_credentials = FakeComputeCredentials()
    fake_storage_client = Mock(return_value="client")
    fake_request = object()
    fake_signing_credentials = Mock()

    monkeypatch.setattr(signed_urls, "_auth_default", lambda: (fake_credentials, "project-1"))
    monkeypatch.setattr(signed_urls, "_auth_request", lambda: fake_request)
    monkeypatch.setattr(
        signed_urls, "_build_signing_credentials", lambda _creds: fake_signing_credentials
    )
    monkeypatch.setattr(signed_urls, "_storage_client_factory", fake_storage_client)

    client, credentials = _storage_client()

    assert client == "client"
    assert credentials is fake_signing_credentials
    assert fake_credentials.refresh_calls == 1
    fake_signing_credentials.refresh.assert_called_once_with(fake_request)
    fake_storage_client.assert_called_once_with(fake_signing_credentials, "project-1")


def test_storage_client_keeps_signing_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeServiceAccountCredentials:
        def __init__(self) -> None:
            self.service_account_email = "svc@example.iam.gserviceaccount.com"
            self.signer = object()
            self.sign_bytes = Mock(return_value=b"existing")
            self.refresh_calls = 0

        def refresh(self, _request: object) -> None:
            self.refresh_calls += 1

    fake_credentials = FakeServiceAccountCredentials()
    fake_storage_client = Mock(return_value="client")
    fake_request = object()
    monkeypatch.setattr(signed_urls, "_auth_default", lambda: (fake_credentials, "project-1"))
    monkeypatch.setattr(signed_urls, "_auth_request", lambda: fake_request)
    monkeypatch.setattr(signed_urls, "_build_signing_credentials", lambda _creds: fake_credentials)
    monkeypatch.setattr(signed_urls, "_storage_client_factory", fake_storage_client)

    _, credentials = _storage_client()

    assert credentials is fake_credentials
    assert fake_credentials.refresh_calls == 1
