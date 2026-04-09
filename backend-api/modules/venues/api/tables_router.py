from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from infrastructure.persistence.models import Layout, LayoutTable, UserTenantMembership, Venue, Zone
from shared.api.deps import DbSession, StaffUserDep

router = APIRouter(prefix="/layouts", tags=["layouts"])


def _ensure_tenant_staff(db: Session, staff_id: UUID, tenant_id: UUID) -> None:
    m = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == staff_id,
            UserTenantMembership.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=403, detail="Not allowed for this tenant")


def _layout_tenant(db: Session, layout_id: UUID) -> UUID:
    lo = db.get(Layout, layout_id)
    if lo is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    venue = db.get(Venue, lo.venue_id)
    assert venue is not None
    return venue.tenant_id


class TableCreate(BaseModel):
    code: str = Field(max_length=64)
    table_capacity_limit: int = Field(default=10, ge=1)
    zone_id: UUID | None = None
    position_json: dict | None = None
    is_public_selectable: bool = True


class TableOut(BaseModel):
    id: UUID
    layout_id: UUID
    code: str
    table_capacity_limit: int
    current_occupied_spots: int
    zone_id: UUID | None

    model_config = {"from_attributes": True}


@router.get("/{layout_id}/tables", response_model=list[TableOut])
def list_tables(layout_id: UUID, db: DbSession, staff: StaffUserDep) -> list[LayoutTable]:
    tid = _layout_tenant(db, layout_id)
    _ensure_tenant_staff(db, staff.id, tid)
    return list(
        db.execute(select(LayoutTable).where(LayoutTable.layout_id == layout_id)).scalars()
    )


@router.post("/{layout_id}/tables", response_model=TableOut)
def create_table(
    layout_id: UUID, body: TableCreate, db: DbSession, staff: StaffUserDep
) -> LayoutTable:
    tid = _layout_tenant(db, layout_id)
    _ensure_tenant_staff(db, staff.id, tid)
    if body.zone_id:
        z = db.get(Zone, body.zone_id)
        if z is None or z.layout_id != layout_id:
            raise HTTPException(status_code=400, detail="Invalid zone for layout")
    t = LayoutTable(
        layout_id=layout_id,
        zone_id=body.zone_id,
        code=body.code,
        table_capacity_limit=body.table_capacity_limit,
        position_json=body.position_json,
        is_public_selectable=body.is_public_selectable,
    )
    db.add(t)
    db.flush()
    return t
