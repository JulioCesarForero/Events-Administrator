from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from modules.reservations.application import reservation_service
from modules.staff_event_groups.api import router as staff_router


def _participant(group_id):
    return SimpleNamespace(
        id=uuid4(),
        attendee_group_id=group_id,
        first_name="Kevin",
        last_name="Serrato",
        document_type="CC",
        document_id="123",
        is_vegetarian=False,
        allergies="",
        mobile_phone="300",
        emergency_contact_name="Ana",
        emergency_contact_phone="301",
        has_reduced_mobility=False,
    )


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDb:
    def __init__(self, participant, rca=None):
        self._participant = participant
        self._rca = rca
        self.calls: list[str] = []
        self.deleted = None
        self.statements: list = []

    def get(self, _model, pk):
        if self._participant and self._participant.id == pk:
            return self._participant
        return None

    def execute(self, stmt):
        self.statements.append(stmt)
        return _FakeResult(self._rca)

    def flush(self):
        self.calls.append("flush")

    def delete(self, obj):
        self.calls.append("delete")
        self.deleted = obj


@pytest.fixture
def staff_env(monkeypatch):
    event_id = uuid4()
    group = SimpleNamespace(id=uuid4(), event_id=event_id)
    audits: list[dict] = []
    monkeypatch.setattr(staff_router, "ensure_super_admin", lambda *_a, **_k: None)
    monkeypatch.setattr(
        staff_router,
        "ensure_event_staff_access",
        lambda *_a, **_k: SimpleNamespace(id=event_id, tenant_id=uuid4()),
    )
    monkeypatch.setattr(staff_router, "_load_group_in_event", lambda *_a, **_k: group)
    monkeypatch.setattr(staff_router, "append_audit_log", lambda _db, **kw: audits.append(kw))
    return SimpleNamespace(event_id=event_id, group=group, audits=audits)


def _call_delete(env, db, participant_id):
    return staff_router.staff_delete_participant(
        event_id=env.event_id,
        participant_id=participant_id,
        body=staff_router.StaffReasonBody(reason="Cambio solicitado"),
        db=db,
        staff=SimpleNamespace(id=uuid4()),
    )


def test_staff_delete_participant_without_code(staff_env) -> None:
    p = _participant(staff_env.group.id)
    db = _FakeDb(p)

    resp = _call_delete(staff_env, db, p.id)

    assert resp.status_code == 204
    assert db.deleted is p
    (audit,) = staff_env.audits
    assert audit["action"] == "STAFF_DELETE_PARTICIPANT"
    assert audit["payload_json"]["vacatedReservationCode"] is None
    assert audit["payload_json"]["participant"]["first_name"] == "Kevin"


def test_staff_delete_participant_with_code_leaves_it_vacant(staff_env) -> None:
    p = _participant(staff_env.group.id)
    rca = SimpleNamespace(participant_id=p.id, reservation_code="R000007")
    db = _FakeDb(p, rca=rca)

    _call_delete(staff_env, db, p.id)

    assert rca.participant_id is None
    # The FK is RESTRICT: the code must be detached (and flushed) before the delete.
    assert db.calls.index("flush") < db.calls.index("delete")
    assert staff_env.audits[0]["payload_json"]["vacatedReservationCode"] == "R000007"


def test_staff_delete_participant_not_found(staff_env) -> None:
    db = _FakeDb(None)
    with pytest.raises(HTTPException) as exc:
        _call_delete(staff_env, db, uuid4())
    assert exc.value.status_code == 404
    assert staff_env.audits == []


def test_staff_delete_participant_requires_super_admin(staff_env, monkeypatch) -> None:
    def _deny(*_a, **_k):
        raise HTTPException(status_code=403, detail="Forbidden")

    monkeypatch.setattr(staff_router, "ensure_super_admin", _deny)
    p = _participant(staff_env.group.id)
    db = _FakeDb(p)
    with pytest.raises(HTTPException) as exc:
        _call_delete(staff_env, db, p.id)
    assert exc.value.status_code == 403
    assert db.deleted is None


def test_assign_vacant_code_assigns_participant() -> None:
    rca = SimpleNamespace(participant_id=None, reservation_code="R000003")
    db = _FakeDb(None, rca=rca)
    new_pid = uuid4()

    out = reservation_service.assign_vacant_code(
        db, group_id=uuid4(), event_id=uuid4(), participant_id=new_pid
    )

    assert out is rca
    assert rca.participant_id == new_pid
    sql = str(db.statements[0])
    assert "participant_id IS NULL" in sql
    assert "reservation.status" in sql
    assert "ORDER BY" in sql and "code_sequence_number" in sql


def test_assign_vacant_code_without_vacancy_returns_none() -> None:
    db = _FakeDb(None, rca=None)
    out = reservation_service.assign_vacant_code(
        db, group_id=uuid4(), event_id=uuid4(), participant_id=uuid4()
    )
    assert out is None
