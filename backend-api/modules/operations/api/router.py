from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

from domain.exceptions import ConflictError, NotFoundError, ValidationError
from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import LayoutTable, Reservation
from modules.reservations.application.reservation_service import release_reservation
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access, ensure_super_admin
from shared.api.schemas import CamelModel

router = APIRouter(tags=["operations"])


class ManualAdjustmentBody(CamelModel):
    action: str
    payload: dict[str, Any] | None = None


SUPPORTED_ACTIONS = {
    "APPROVE_PAYMENT",
    "REJECT_PAYMENT",
    "RELEASE_RESERVATION",
    "UPDATE_TABLE_CAPACITY",
    "UPDATE_ATTENDEE_GROUP",
    "CUSTOM",
}


@router.post("/events/{event_id}/manual-adjustments")
def manual_adjustment(
    event_id: UUID,
    body: ManualAdjustmentBody,
    db: DbSession,
    staff: StaffUserDep,
) -> dict:
    ev = ensure_event_staff_access(db, staff, event_id)
    payload = body.payload or {}

    if body.action == "RELEASE_RESERVATION":
        ensure_super_admin(db, staff)
        reservation_id = payload.get("reservation_id")
        if not reservation_id:
            raise ValidationError("reservation_id required in payload")
        res = db.get(Reservation, UUID(reservation_id))
        if res is None or res.event_id != event_id:
            raise HTTPException(status_code=404, detail="Reservation not found")
        try:
            release_reservation(db, res.id, res.attendee_group_id)
        except NotFoundError as e:
            raise HTTPException(status_code=404, detail=e.message) from e
        except ConflictError as e:
            raise HTTPException(status_code=409, detail=e.message) from e

    elif body.action == "UPDATE_TABLE_CAPACITY":
        table_id = payload.get("layout_table_id")
        new_capacity = payload.get("table_capacity_limit")
        if not table_id or new_capacity is None:
            raise ValidationError("layout_table_id and table_capacity_limit required")
        t = db.get(LayoutTable, UUID(table_id))
        if t is None:
            raise HTTPException(status_code=404, detail="Table not found")
        if int(new_capacity) < t.current_occupied_spots:
            raise ConflictError("New capacity cannot be less than current occupied spots")
        t.table_capacity_limit = int(new_capacity)

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
    return {"recorded": True, "action": body.action}
