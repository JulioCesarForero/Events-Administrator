from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import Field

from shared.api.schemas import CamelModel, CamelOrmModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from infrastructure.persistence.models import Layout, UserTenantMembership, Venue
from shared.api.deps import DbSession, StaffUserDep

router = APIRouter(prefix="/venues", tags=["venues"])


def _ensure_tenant_staff(db: Session, staff_id: UUID, tenant_id: UUID) -> None:
    m = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == staff_id,
            UserTenantMembership.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=403, detail="Not allowed for this tenant")


class VenueCreate(CamelModel):
    tenant_id: UUID
    name: str = Field(max_length=200)
    address: str | None = None
    default_timezone: str = Field(default="UTC", max_length=64)


class VenueOut(CamelOrmModel):
    id: UUID
    tenant_id: UUID
    name: str
    address: str | None
    default_timezone: str


@router.get("", response_model=list[VenueOut])
def list_venues(
    tenant_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[Venue]:
    _ensure_tenant_staff(db, staff.id, tenant_id)
    return list(
        db.execute(select(Venue).where(Venue.tenant_id == tenant_id).order_by(Venue.name)).scalars()
    )


@router.post("", response_model=VenueOut)
def create_venue(body: VenueCreate, db: DbSession, staff: StaffUserDep) -> Venue:
    _ensure_tenant_staff(db, staff.id, body.tenant_id)
    v = Venue(
        tenant_id=body.tenant_id,
        name=body.name,
        address=body.address,
        default_timezone=body.default_timezone,
    )
    db.add(v)
    db.flush()
    return v


class LayoutCreate(CamelModel):
    name: str = Field(max_length=200)
    status: str = Field(default="DRAFT", max_length=32)


class LayoutOut(CamelOrmModel):
    id: UUID
    venue_id: UUID
    name: str
    status: str
    version: int


@router.get("/{venue_id}/layouts", response_model=list[LayoutOut])
def list_layouts(venue_id: UUID, db: DbSession, staff: StaffUserDep) -> list[Layout]:
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    _ensure_tenant_staff(db, staff.id, venue.tenant_id)
    return list(db.execute(select(Layout).where(Layout.venue_id == venue_id)).scalars())


@router.post("/{venue_id}/layouts", response_model=LayoutOut)
def create_layout(
    venue_id: UUID, body: LayoutCreate, db: DbSession, staff: StaffUserDep
) -> Layout:
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    _ensure_tenant_staff(db, staff.id, venue.tenant_id)
    lo = Layout(venue_id=venue_id, name=body.name, status=body.status)
    db.add(lo)
    db.flush()
    return lo


