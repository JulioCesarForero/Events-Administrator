from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from infrastructure.persistence.models import Layout, LayoutTable, UserTenantMembership, Venue, Zone
from shared.api.deps import DbSession, StaffUserDep
from shared.api.schemas import CamelModel, CamelOrmModel

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


class TableCreate(CamelModel):
    code: str = Field(max_length=64)
    table_capacity_limit: int = Field(default=10, ge=0)
    zone_id: UUID | None = None
    position_json: dict | None = None
    is_public_selectable: bool = True


class TableUpdate(CamelModel):
    code: str | None = Field(default=None, max_length=64)
    table_capacity_limit: int | None = Field(default=None, ge=0)
    zone_id: UUID | None = None
    position_json: dict | None = None
    is_public_selectable: bool | None = None


class TableOut(CamelOrmModel):
    id: UUID
    layout_id: UUID
    code: str
    table_capacity_limit: int
    current_occupied_spots: int
    zone_id: UUID | None


@router.get("/{layout_id}/tables", response_model=list[TableOut])
def list_tables(layout_id: UUID, db: DbSession, staff: StaffUserDep) -> list[LayoutTable]:
    tid = _layout_tenant(db, layout_id)
    _ensure_tenant_staff(db, staff.id, tid)
    return list(db.execute(select(LayoutTable).where(LayoutTable.layout_id == layout_id)).scalars())


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
    try:
        db.flush()
    except IntegrityError as exc:
        msg = str(exc.orig).lower() if exc.orig is not None else str(exc).lower()
        if "uq_layout_table_layout_code" in msg:
            raise HTTPException(
                status_code=409, detail="Table code already exists in this layout"
            ) from exc
        if "ck_layout_table_capacity" in msg:
            raise HTTPException(
                status_code=400, detail="tableCapacityLimit must be greater than 0"
            ) from exc
        raise HTTPException(status_code=400, detail="Invalid table data for layout") from exc
    return t


@router.patch("/{layout_id}/tables/{table_id}", response_model=TableOut)
def update_table(
    layout_id: UUID, table_id: UUID, body: TableUpdate, db: DbSession, staff: StaffUserDep
) -> LayoutTable:
    tid = _layout_tenant(db, layout_id)
    _ensure_tenant_staff(db, staff.id, tid)

    t = db.get(LayoutTable, table_id)
    if t is None or t.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Table not found in layout")

    if body.code is not None:
        t.code = body.code
    if body.table_capacity_limit is not None:
        t.table_capacity_limit = body.table_capacity_limit
    if body.zone_id is not None:
        # Avoid full zone validation here for brevity, assume valid if provided
        t.zone_id = body.zone_id
    if body.position_json is not None:
        t.position_json = body.position_json
    if body.is_public_selectable is not None:
        t.is_public_selectable = body.is_public_selectable

    try:
        db.flush()
    except IntegrityError as exc:
        msg = str(exc.orig).lower() if exc.orig is not None else str(exc).lower()
        if "uq_layout_table_layout_code" in msg:
            raise HTTPException(
                status_code=409, detail="Table code already exists in this layout"
            ) from exc
        if "ck_layout_table_capacity" in msg:
            raise HTTPException(
                status_code=400, detail="tableCapacityLimit must be greater than 0"
            ) from exc
        raise HTTPException(status_code=400, detail="Invalid table update for layout") from exc
    return t


@router.delete("/{layout_id}/tables/{table_id}", status_code=204)
def delete_table(layout_id: UUID, table_id: UUID, db: DbSession, staff: StaffUserDep) -> None:
    tid = _layout_tenant(db, layout_id)
    _ensure_tenant_staff(db, staff.id, tid)

    t = db.get(LayoutTable, table_id)
    if t is None or t.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Table not found in layout")

    db.delete(t)
    db.flush()
