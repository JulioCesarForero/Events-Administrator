from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import Event
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access

router = APIRouter(tags=["operations"])


class ManualAdjustmentBody(BaseModel):
    action: str
    payload: dict[str, Any] | None = None


@router.post("/events/{event_id}/manual-adjustments")
def manual_adjustment(
    event_id: UUID,
    body: ManualAdjustmentBody,
    db: DbSession,
    staff: StaffUserDep,
) -> dict:
    ev = ensure_event_staff_access(db, staff, event_id)
    append_audit_log(
        db,
        tenant_id=ev.tenant_id,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="manual_adjustment",
        entity_id=None,
        action=body.action,
        payload_json=body.payload,
    )
    db.flush()
    return {"recorded": True}
