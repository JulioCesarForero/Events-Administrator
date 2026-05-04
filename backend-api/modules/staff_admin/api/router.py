"""Tenant-admin CRUD for StaffUsers and per-event staff assignments.

Endpoints are gated by ``ensure_tenant_admin`` which requires the authenticated
StaffUser to have a ``UserTenantMembership`` with role ``ADMIN`` or ``OWNER``
on the target tenant.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import AfterValidator, Field
from sqlalchemy import func, select

from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import (
    Event,
    EventOrganizerAssignment,
    StaffUser,
    UserTenantMembership,
)
from infrastructure.security.password import hash_password
from shared.api.deps import (
    DbSession,
    StaffUserDep,
    ensure_event_staff_access,
    ensure_tenant_admin,
)
from shared.api.schemas import CamelModel, CamelOrmModel

router = APIRouter(tags=["staff-admin"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL_RE.match(v):
        raise ValueError("Not a valid email address")
    return v


Email = Annotated[str, AfterValidator(_check_email)]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class StaffUserCreate(CamelModel):
    email: Email
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    role: str = Field(default="STAFF", max_length=64)


class StaffUserPatch(CamelModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    password: str | None = Field(default=None, min_length=8, max_length=200)
    status: str | None = Field(default=None, max_length=32)
    role: str | None = Field(default=None, max_length=64)


class StaffUserOut(CamelOrmModel):
    id: UUID
    email: str
    display_name: str
    status: str
    created_at: datetime
    role: str | None = None
    event_assignments_count: int = 0


class StaffAssignmentCreate(CamelModel):
    user_id: UUID
    role: str = Field(min_length=1, max_length=64)


class StaffAssignmentOut(CamelOrmModel):
    user_id: UUID
    event_id: UUID
    email: str
    display_name: str
    role: str
    status: str


# ---------------------------------------------------------------------------
# Tenant staff CRUD
# ---------------------------------------------------------------------------


def _serialize_user(user: StaffUser, role: str | None, assignments_count: int) -> StaffUserOut:
    return StaffUserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
        created_at=user.created_at,
        role=role,
        event_assignments_count=assignments_count,
    )


@router.get(
    "/tenants/{tenant_id}/staff-users",
    response_model=list[StaffUserOut],
)
def list_tenant_staff_users(
    tenant_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[StaffUserOut]:
    ensure_tenant_admin(db, staff, tenant_id)
    rows = db.execute(
        select(StaffUser, UserTenantMembership)
        .join(
            UserTenantMembership,
            UserTenantMembership.user_id == StaffUser.id,
        )
        .where(UserTenantMembership.tenant_id == tenant_id)
        .order_by(StaffUser.created_at.desc())
    ).all()

    user_ids = [u.id for u, _ in rows]
    counts: dict[UUID, int] = {}
    if user_ids:
        count_rows = db.execute(
            select(
                EventOrganizerAssignment.user_id,
                func.count(EventOrganizerAssignment.id),
            )
            .where(EventOrganizerAssignment.user_id.in_(user_ids))
            .group_by(EventOrganizerAssignment.user_id)
        ).all()
        counts = {uid: int(n) for uid, n in count_rows}

    return [
        _serialize_user(user, membership.role, counts.get(user.id, 0)) for user, membership in rows
    ]


@router.post(
    "/tenants/{tenant_id}/staff-users",
    response_model=StaffUserOut,
    status_code=201,
)
def create_tenant_staff_user(
    tenant_id: UUID,
    body: StaffUserCreate,
    db: DbSession,
    staff: StaffUserDep,
) -> StaffUserOut:
    ensure_tenant_admin(db, staff, tenant_id)

    existing = db.execute(
        select(StaffUser).where(StaffUser.email == body.email)
    ).scalar_one_or_none()

    if existing is None:
        user = StaffUser(
            email=body.email,
            display_name=body.display_name,
            password_hash=hash_password(body.password),
        )
        db.add(user)
        db.flush()
    else:
        user = existing
        already = db.execute(
            select(UserTenantMembership).where(
                UserTenantMembership.tenant_id == tenant_id,
                UserTenantMembership.user_id == user.id,
            )
        ).scalar_one_or_none()
        if already is not None:
            raise HTTPException(
                status_code=409,
                detail="User already belongs to this tenant",
            )

    db.add(
        UserTenantMembership(
            tenant_id=tenant_id,
            user_id=user.id,
            role=body.role,
        )
    )
    db.flush()

    append_audit_log(
        db,
        tenant_id=tenant_id,
        event_id=None,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="staff_user",
        entity_id=user.id,
        action="CREATE",
    )
    return _serialize_user(user, body.role, 0)


@router.patch("/staff-users/{user_id}", response_model=StaffUserOut)
def patch_staff_user(
    user_id: UUID,
    body: StaffUserPatch,
    db: DbSession,
    staff: StaffUserDep,
) -> StaffUserOut:
    user = db.get(StaffUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    membership = (
        db.execute(
            select(UserTenantMembership).where(
                UserTenantMembership.user_id == user_id,
            )
        )
        .scalars()
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="User has no tenant")
    ensure_tenant_admin(db, staff, membership.tenant_id)

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.status is not None:
        if body.status not in ("ACTIVE", "INVITED", "DISABLED"):
            raise HTTPException(status_code=400, detail="Invalid status")
        user.status = body.status
    if body.role is not None:
        membership.role = body.role
    db.flush()

    count = db.execute(
        select(func.count(EventOrganizerAssignment.id)).where(
            EventOrganizerAssignment.user_id == user_id
        )
    ).scalar_one()

    append_audit_log(
        db,
        tenant_id=membership.tenant_id,
        event_id=None,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="staff_user",
        entity_id=user.id,
        action="UPDATE",
    )
    return _serialize_user(user, membership.role, int(count))


# ---------------------------------------------------------------------------
# Per-event staff assignments
# ---------------------------------------------------------------------------


@router.get(
    "/events/{event_id}/staff-assignments",
    response_model=list[StaffAssignmentOut],
)
def list_event_staff(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[StaffAssignmentOut]:
    ev = db.get(Event, event_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    ensure_tenant_admin(db, staff, ev.tenant_id)

    rows = db.execute(
        select(EventOrganizerAssignment, StaffUser)
        .join(StaffUser, StaffUser.id == EventOrganizerAssignment.user_id)
        .where(EventOrganizerAssignment.event_id == event_id)
        .order_by(EventOrganizerAssignment.created_at.asc())
    ).all()
    return [
        StaffAssignmentOut(
            user_id=user.id,
            event_id=event_id,
            email=user.email,
            display_name=user.display_name,
            role=a.role,
            status=user.status,
        )
        for a, user in rows
    ]


@router.post(
    "/events/{event_id}/staff-assignments",
    response_model=StaffAssignmentOut,
    status_code=201,
)
def assign_event_staff(
    event_id: UUID,
    body: StaffAssignmentCreate,
    db: DbSession,
    staff: StaffUserDep,
) -> StaffAssignmentOut:
    ev = db.get(Event, event_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    ensure_tenant_admin(db, staff, ev.tenant_id)

    user = db.get(StaffUser, body.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Staff user not found")
    tenant_member = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == user.id,
            UserTenantMembership.tenant_id == ev.tenant_id,
        )
    ).scalar_one_or_none()
    if tenant_member is None:
        raise HTTPException(
            status_code=400,
            detail="Staff user does not belong to the event tenant",
        )

    existing = db.execute(
        select(EventOrganizerAssignment).where(
            EventOrganizerAssignment.event_id == event_id,
            EventOrganizerAssignment.user_id == user.id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Staff user already assigned to event")

    assignment = EventOrganizerAssignment(
        event_id=event_id,
        user_id=user.id,
        role=body.role,
    )
    db.add(assignment)
    db.flush()

    append_audit_log(
        db,
        tenant_id=ev.tenant_id,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="event_staff_assignment",
        entity_id=assignment.id,
        action="CREATE",
    )

    return StaffAssignmentOut(
        user_id=user.id,
        event_id=event_id,
        email=user.email,
        display_name=user.display_name,
        role=body.role,
        status=user.status,
    )


@router.delete(
    "/events/{event_id}/staff-assignments/{user_id}",
    status_code=204,
    response_model=None,
)
def unassign_event_staff(
    event_id: UUID,
    user_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> None:
    ev = db.get(Event, event_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    ensure_tenant_admin(db, staff, ev.tenant_id)
    # Prevent an admin from removing the last staff assignment that is them-selves.
    assignment = db.execute(
        select(EventOrganizerAssignment).where(
            EventOrganizerAssignment.event_id == event_id,
            EventOrganizerAssignment.user_id == user_id,
        )
    ).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.flush()
    append_audit_log(
        db,
        tenant_id=ev.tenant_id,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="event_staff_assignment",
        entity_id=assignment.id,
        action="DELETE",
    )
    # Ensure caller retains access after the mutation (silences ruff unused).
    ensure_event_staff_access(db, staff, event_id)
