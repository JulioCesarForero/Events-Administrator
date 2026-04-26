from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from modules.attendees.api import router as attendees_router


class _FakeDb:
    def __init__(self, participant):
        self._participant = participant
        self.deleted = None
        self.flushed = False

    def get(self, _model, participant_id):
        if self._participant and self._participant.id == participant_id:
            return self._participant
        return None

    def delete(self, participant):
        self.deleted = participant

    def flush(self):
        self.flushed = True


def test_delete_participant_success(monkeypatch) -> None:
    group_id = uuid4()
    participant = SimpleNamespace(id=uuid4(), attendee_group_id=group_id)
    fake_db = _FakeDb(participant)
    fake_group = SimpleNamespace(event_id=uuid4())
    fake_event = SimpleNamespace(id=fake_group.event_id, event_date=None)

    monkeypatch.setattr(attendees_router, "_can_access_group", lambda *_args, **_kwargs: fake_group)
    monkeypatch.setattr(attendees_router, "_load_event_for_group", lambda *_args, **_kwargs: fake_event)
    monkeypatch.setattr(attendees_router, "_event_timezone", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        attendees_router,
        "ensure_participant_editable_window",
        lambda *_args, **_kwargs: None,
    )

    attendees_router.delete_participant(
        group_id=group_id,
        participant_id=participant.id,
        db=fake_db,
        claims={"typ": "buyer"},
    )

    assert fake_db.deleted == participant
    assert fake_db.flushed is True


def test_delete_participant_not_found_for_group(monkeypatch) -> None:
    group_id = uuid4()
    participant = SimpleNamespace(id=uuid4(), attendee_group_id=uuid4())
    fake_db = _FakeDb(participant)
    fake_group = SimpleNamespace(event_id=uuid4())
    fake_event = SimpleNamespace(id=fake_group.event_id, event_date=None)

    monkeypatch.setattr(attendees_router, "_can_access_group", lambda *_args, **_kwargs: fake_group)
    monkeypatch.setattr(attendees_router, "_load_event_for_group", lambda *_args, **_kwargs: fake_event)
    monkeypatch.setattr(attendees_router, "_event_timezone", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        attendees_router,
        "ensure_participant_editable_window",
        lambda *_args, **_kwargs: None,
    )

    with pytest.raises(HTTPException, match="Participant not found"):
        attendees_router.delete_participant(
            group_id=group_id,
            participant_id=participant.id,
            db=fake_db,
            claims={"typ": "buyer"},
        )
