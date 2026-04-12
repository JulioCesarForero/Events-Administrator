from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import Field

from shared.api.schemas import CamelModel, CamelOrmModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from infrastructure.persistence.models import (
    Event,
    EventConfiguration,
    EventLayoutBinding,
    EventOrganizerAssignment,
    Layout,
    UserTenantMembership,
    Venue,
)
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access

router = APIRouter(prefix="/events", tags=["events"])


def _ensure_tenant_staff(db: Session, staff_id: UUID, tenant_id: UUID) -> None:
    m = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == staff_id,
            UserTenantMembership.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=403, detail="Not allowed for this tenant")


class EventCreate(CamelModel):
    tenant_id: UUID
    venue_id: UUID
    name: str = Field(max_length=300)
    event_date: datetime
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    venue_name_snapshot: str | None = Field(default=None, max_length=300)
    venue_address_snapshot: str | None = None
    venue_lat: float | None = None
    venue_lon: float | None = None
    status: str = Field(default="DRAFT", max_length=32)


class EventOut(CamelOrmModel):
    id: UUID
    tenant_id: UUID
    venue_id: UUID
    name: str
    event_date: datetime
    status: str


@router.get("", response_model=list[EventOut])
def list_events(tenant_id: UUID, db: DbSession, staff: StaffUserDep) -> list[Event]:
    _ensure_tenant_staff(db, staff.id, tenant_id)
    return list(
        db.execute(select(Event).where(Event.tenant_id == tenant_id).order_by(Event.event_date)).scalars()
    )


@router.post("", response_model=EventOut)
def create_event(body: EventCreate, db: DbSession, staff: StaffUserDep) -> Event:
    _ensure_tenant_staff(db, staff.id, body.tenant_id)
    venue = db.get(Venue, body.venue_id)
    if venue is None or venue.tenant_id != body.tenant_id:
        raise HTTPException(status_code=400, detail="Venue not valid for tenant")
    ev = Event(
        tenant_id=body.tenant_id,
        venue_id=body.venue_id,
        name=body.name,
        event_date=body.event_date,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        venue_name_snapshot=body.venue_name_snapshot,
        venue_address_snapshot=body.venue_address_snapshot,
        venue_lat=body.venue_lat,
        venue_lon=body.venue_lon,
        status=body.status,
    )
    db.add(ev)
    db.flush()
    db.add(
        EventOrganizerAssignment(event_id=ev.id, user_id=staff.id, role="ORGANIZER")
    )
    return ev


class EventConfigurationUpdate(CamelModel):
    timezone: str = Field(default="America/Bogota", max_length=64)
    presale_start_date: datetime
    presale_end_date: datetime
    sale_start_date: datetime
    sale_end_date: datetime
    max_presale_tickets: int = Field(default=4, ge=0)
    max_sale_tickets: int = Field(default=3, ge=0)
    map_visibility_policy: str = Field(default="AFTER_PAYMENT_APPROVED", max_length=64)


class EventConfigurationOut(CamelOrmModel):
    id: UUID
    event_id: UUID
    timezone: str
    presale_start_date: datetime
    presale_end_date: datetime
    sale_start_date: datetime
    sale_end_date: datetime
    max_presale_tickets: int
    max_sale_tickets: int
    map_visibility_policy: str


@router.put("/{event_id}/configuration", response_model=EventConfigurationOut)
def put_configuration(
    event_id: UUID,
    body: EventConfigurationUpdate,
    db: DbSession,
    staff: StaffUserDep,
) -> EventConfiguration:
    ensure_event_staff_access(db, staff, event_id)
    existing = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    if existing:
        for k, v in body.model_dump().items():
            setattr(existing, k, v)
        db.flush()
        return existing
    cfg = EventConfiguration(event_id=event_id, **body.model_dump())
    db.add(cfg)
    db.flush()
    return cfg


class LayoutBindingCreate(CamelModel):
    layout_id: UUID
    layout_version: int = Field(ge=1)


class LayoutBindingOut(CamelOrmModel):
    id: UUID
    event_id: UUID
    layout_id: UUID
    layout_version: int


@router.post("/{event_id}/layout-binding", response_model=LayoutBindingOut)
def bind_layout(
    event_id: UUID,
    body: LayoutBindingCreate,
    db: DbSession,
    staff: StaffUserDep,
) -> EventLayoutBinding:
    ev = ensure_event_staff_access(db, staff, event_id)
    layout = db.get(Layout, body.layout_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    venue = db.get(Venue, layout.venue_id)
    if venue is None or venue.tenant_id != ev.tenant_id:
        raise HTTPException(status_code=400, detail="Layout tenant mismatch")
    if layout.version != body.layout_version:
        raise HTTPException(status_code=409, detail="Layout version mismatch")
    b = EventLayoutBinding(
        event_id=event_id,
        layout_id=body.layout_id,
        layout_version=body.layout_version,
    )
    db.add(b)
    db.flush()
    return b
