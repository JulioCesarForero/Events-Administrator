"""Integration tests for GET /v1/payments/{id}/evidences (staff only)."""
from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient


def _client_with_overrides(db, staff):
    from app.main import app
    from shared.api.deps import get_current_staff, get_db

    def _override_db():
        yield db

    def _override_staff():
        return staff

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_staff] = _override_staff
    return TestClient(app), app


def test_list_evidences_requires_auth() -> None:
    from app.main import app

    client = TestClient(app)
    r = client.get(f"/v1/payments/{uuid4()}/evidences")
    # `StaffUserDep` rejects anonymous callers.
    assert r.status_code == 401


def test_list_evidences_returns_rows() -> None:
    event_id = uuid4()
    payment_id = uuid4()
    staff = SimpleNamespace(id=uuid4())

    payment = SimpleNamespace(
        id=payment_id, event_id=event_id, tenant_id=uuid4()
    )
    event = SimpleNamespace(id=event_id, tenant_id=payment.tenant_id)

    def fake_get(model, key):
        name = getattr(model, "__name__", "")
        if name == "Payment":
            return payment
        if name == "Event":
            return event
        return None

    evidence = SimpleNamespace(
        id=uuid4(),
        payment_id=payment_id,
        file_url="https://firebasestorage.googleapis.com/...token=abc",
        mime_type="image/png",
        evidence_type="DIGITAL_PROOF",
        uploaded_by_actor_type="BUYER",
        storage_path=f"payment-evidence/{event_id}/gid/{payment_id}/123_file.png",
        file_name="file.png",
        size_bytes=1024,
        created_at=datetime.now(UTC),
    )

    db = MagicMock()
    db.get.side_effect = fake_get
    # First execute call: ensure_event_staff_access → EventOrganizerAssignment row.
    # Subsequent execute call: evidences query.
    assignment = SimpleNamespace(role="ORGANIZER")
    scalar_sequence = [assignment]

    scalars = MagicMock()
    scalars.__iter__ = lambda self: iter([evidence])

    execute_results = [
        SimpleNamespace(scalar_one_or_none=lambda: scalar_sequence.pop(0)),
        SimpleNamespace(scalars=lambda: scalars),
    ]

    def fake_execute(_stmt):
        return execute_results.pop(0)

    db.execute.side_effect = fake_execute

    client, app = _client_with_overrides(db, staff)
    try:
        r = client.get(f"/v1/payments/{payment_id}/evidences")
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body) == 1
        assert body[0]["fileName"] == "file.png"
        assert body[0]["storagePath"].startswith("payment-evidence/")
        assert body[0]["mimeType"] == "image/png"
    finally:
        app.dependency_overrides.clear()
