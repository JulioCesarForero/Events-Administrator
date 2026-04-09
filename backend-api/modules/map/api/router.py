from uuid import UUID

import jwt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from config.settings import settings
from infrastructure.persistence.models import (
    AttendeeGroup,
    EventConfiguration,
    EventLayoutBinding,
    LayoutTable,
    Payment,
    StaffUser,
)
from infrastructure.security.jwt_tokens import decode_token
from shared.api.deps import DbSession, ensure_event_staff_access

router = APIRouter(tags=["map"])


class MapTableOut(BaseModel):
    layout_table_id: UUID
    code: str
    capacity: int
    occupied: int
    available: int
    position_json: dict | None


def _latest_binding(db, event_id: UUID) -> EventLayoutBinding:
    b = db.execute(
        select(EventLayoutBinding)
        .where(EventLayoutBinding.event_id == event_id)
        .order_by(EventLayoutBinding.bound_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="No layout bound to this event")
    return b


def _map_tables(db, layout_id: UUID) -> list[MapTableOut]:
    rows = db.execute(select(LayoutTable).where(LayoutTable.layout_id == layout_id)).scalars()
    out: list[MapTableOut] = []
    for t in rows:
        avail = t.table_capacity_limit - t.current_occupied_spots
        out.append(
            MapTableOut(
                layout_table_id=t.id,
                code=t.code,
                capacity=t.table_capacity_limit,
                occupied=t.current_occupied_spots,
                available=max(0, avail),
                position_json=t.position_json,
            )
        )
    return out


@router.get("/events/{event_id}/map", response_model=list[MapTableOut])
def get_event_map(event_id: UUID, request: Request, db: DbSession) -> list[MapTableOut]:
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = auth.split(" ", 1)[1].strip()

    layout_id: UUID | None = None

    try:
        payload = decode_token(token, settings.jwt_staff_audience)
        user = db.get(StaffUser, UUID(payload["sub"]))
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        ensure_event_staff_access(db, user, event_id)
        layout_id = _latest_binding(db, event_id).layout_id
    except HTTPException:
        raise
    except jwt.PyJWTError:
        layout_id = None

    if layout_id is None:
        try:
            payload = decode_token(token, settings.jwt_buyer_audience)
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail="Invalid token") from e
        if payload.get("typ") != "buyer":
            raise HTTPException(status_code=403, detail="Invalid token")
        if UUID(payload["event_id"]) != event_id:
            raise HTTPException(status_code=403, detail="Token not scoped to event")
        gid = UUID(payload["sub"])
        g = db.get(AttendeeGroup, gid)
        if g is None or g.event_id != event_id:
            raise HTTPException(status_code=403, detail="Invalid buyer session")
        cfg = db.execute(
            select(EventConfiguration).where(EventConfiguration.event_id == event_id)
        ).scalar_one_or_none()
        policy = cfg.map_visibility_policy if cfg else "AFTER_PAYMENT_APPROVED"
        if policy == "AFTER_PAYMENT_APPROVED":
            if g.current_payment_id is None:
                raise HTTPException(status_code=403, detail="Map not visible yet")
            pay = db.get(Payment, g.current_payment_id)
            if pay is None or pay.status != "APPROVED":
                raise HTTPException(
                    status_code=403, detail="Map not visible until payment approved"
                )
        layout_id = _latest_binding(db, event_id).layout_id

    return _map_tables(db, layout_id)
