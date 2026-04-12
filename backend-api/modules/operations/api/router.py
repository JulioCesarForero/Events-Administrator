from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select

from shared.api.schemas import CamelModel
from domain.exceptions import ConflictError, ValidationError
from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import (
    AttendeeGroup,
    Event,
    LayoutTable,
    Payment,
    Reservation,
    TableReservation,
)
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access

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
        reservation_id = payload.get("reservation_id")
        if not reservation_id:
            raise ValidationError("reservation_id required in payload")
        res = db.get(Reservation, UUID(reservation_id))
        if res is None or res.event_id != event_id:
            raise HTTPException(status_code=404, detail="Reservation not found")
        if res.status != "CONFIRMED":
            raise ConflictError("Reservation is not active")
        trs = list(
            db.execute(
                select(TableReservation).where(
                    TableReservation.reservation_id == res.id,
                    TableReservation.status == "ACTIVE",
                )
            ).scalars()
        )
        for tr in trs:
            t = db.get(LayoutTable, tr.layout_table_id)
            if t:
                t.current_occupied_spots = max(0, t.current_occupied_spots - tr.spots_reserved)
            tr.status = "RELEASED"
        res.status = "RELEASED"
        grp = db.get(AttendeeGroup, res.attendee_group_id)
        if grp:
            grp.reservation_status = "NONE"

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
