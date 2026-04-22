"""Integration tests for the public (buyer-facing) legal documents endpoint.

The endpoint exposed at ``/v1/portal/events/{event_id}/published-legal-documents``
is intentionally unauthenticated so that the buyer can read the Política de
tratamiento de datos and Términos y condiciones both before and after
logging in. These tests override the DB dependency to keep them hermetic.
"""
from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient


def _client_with_db(db):
    from app.main import app
    from shared.api.deps import get_db

    def _override():
        yield db

    app.dependency_overrides[get_db] = _override
    return TestClient(app), app


def test_published_legal_requires_existing_event() -> None:
    db = MagicMock()
    # `db.get(Event, ...)` → None ⇒ 404.
    db.get.return_value = None
    client, app = _client_with_db(db)
    try:
        r = client.get(
            f"/v1/portal/events/{uuid4()}/published-legal-documents",
        )
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_published_legal_returns_only_published_docs() -> None:
    db = MagicMock()
    event_id = uuid4()
    db.get.return_value = SimpleNamespace(id=event_id)
    published = SimpleNamespace(
        id=uuid4(),
        event_id=event_id,
        document_type="DATA_POLICY",
        version_label="v1",
        title="Política de tratamiento de datos",
        content_markdown="# Política\nContenido",
        status="PUBLISHED",
        published_at=datetime.now(UTC),
    )
    scalars = MagicMock()
    scalars.__iter__ = lambda self: iter([published])
    db.execute.return_value.scalars.return_value = scalars

    client, app = _client_with_db(db)
    try:
        r = client.get(
            f"/v1/portal/events/{event_id}/published-legal-documents",
        )
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) == 1
        assert body[0]["documentType"] == "DATA_POLICY"
        assert body[0]["contentMarkdown"].startswith("# Política")
        assert body[0]["status"] == "PUBLISHED"
    finally:
        app.dependency_overrides.clear()
