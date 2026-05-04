"""Super-admin CRUD for StaffUsers globally.

Endpoints are gated by ``ensure_super_admin`` which requires the authenticated
StaffUser to have a ``UserTenantMembership`` with role ``SUPER_ADMIN`` globally.
"""

from __future__ import annotations

import re
import secrets
import string
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import AfterValidator, Field
from sqlalchemy import select

from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import (
    StaffUser,
    UserTenantMembership,
)
from infrastructure.security.password import hash_password
from shared.api.deps import (
    DbSession,
    StaffUserDep,
    ensure_super_admin,
)
from shared.api.schemas import CamelModel, CamelOrmModel

router = APIRouter(prefix="/admin", tags=["system-admin"])

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


class SystemUserMembershipInput(CamelModel):
    tenant_id: UUID
    role: str = Field(min_length=1, max_length=64)


class SystemUserCreate(CamelModel):
    email: Email
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    memberships: list[SystemUserMembershipInput] = Field(default_factory=list)


class SystemUserPatch(CamelModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, max_length=32)
    # If provided, updates or creates the membership for this tenant
    tenant_id: UUID | None = None
    role: str | None = Field(default=None, max_length=64)


class SystemUserOut(CamelOrmModel):
    id: UUID
    email: str
    display_name: str
    status: str
    created_at: datetime
    role: str | None = None  # In the context of a specific tenant, if applicable


class PasswordResetOut(CamelModel):
    new_password: str


# ---------------------------------------------------------------------------
# Super Admin Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/tenants/{tenant_id}/users",
    response_model=list[SystemUserOut],
)
def list_system_users_by_tenant(
    tenant_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[SystemUserOut]:
    ensure_super_admin(db, staff)

    rows = db.execute(
        select(StaffUser, UserTenantMembership)
        .join(
            UserTenantMembership,
            UserTenantMembership.user_id == StaffUser.id,
        )
        .where(UserTenantMembership.tenant_id == tenant_id)
        .order_by(StaffUser.created_at.desc())
    ).all()

    return [
        SystemUserOut(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            status=user.status,
            created_at=user.created_at,
            role=membership.role,
        )
        for user, membership in rows
    ]


@router.post(
    "/users",
    response_model=SystemUserOut,
    status_code=201,
)
def create_system_user(
    body: SystemUserCreate,
    db: DbSession,
    staff: StaffUserDep,
) -> SystemUserOut:
    ensure_super_admin(db, staff)

    existing = db.execute(
        select(StaffUser).where(StaffUser.email == body.email)
    ).scalar_one_or_none()

    if existing is not None:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    user = StaffUser(
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        status="ACTIVE",
    )
    db.add(user)
    db.flush()

    for mem in body.memberships:
        db.add(
            UserTenantMembership(
                tenant_id=mem.tenant_id,
                user_id=user.id,
                role=mem.role,
            )
        )
    db.flush()

    append_audit_log(
        db,
        tenant_id=None,
        event_id=None,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="staff_user",
        entity_id=user.id,
        action="CREATE_BY_SUPER_ADMIN",
    )

    # Return with the first role if any, else None
    role = body.memberships[0].role if body.memberships else None
    return SystemUserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
        created_at=user.created_at,
        role=role,
    )


@router.patch("/users/{user_id}", response_model=SystemUserOut)
def patch_system_user(
    user_id: UUID,
    body: SystemUserPatch,
    db: DbSession,
    staff: StaffUserDep,
) -> SystemUserOut:
    ensure_super_admin(db, staff)

    user = db.get(StaffUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.status is not None:
        if body.status not in ("ACTIVE", "INVITED", "DISABLED"):
            raise HTTPException(status_code=400, detail="Invalid status")
        user.status = body.status

    role = None
    if body.tenant_id is not None and body.role is not None:
        membership = db.execute(
            select(UserTenantMembership).where(
                UserTenantMembership.user_id == user_id,
                UserTenantMembership.tenant_id == body.tenant_id,
            )
        ).scalar_one_or_none()

        if membership:
            membership.role = body.role
        else:
            membership = UserTenantMembership(
                tenant_id=body.tenant_id,
                user_id=user_id,
                role=body.role,
            )
            db.add(membership)
        role = body.role
    else:
        # Try to get the first role if we didn't update it but need it for response
        membership = db.execute(
            select(UserTenantMembership)
            .where(
                UserTenantMembership.user_id == user_id,
            )
            .limit(1)
        ).scalar_one_or_none()
        if membership:
            role = membership.role

    db.flush()

    append_audit_log(
        db,
        tenant_id=body.tenant_id,
        event_id=None,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="staff_user",
        entity_id=user.id,
        action="UPDATE_BY_SUPER_ADMIN",
    )

    return SystemUserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
        created_at=user.created_at,
        role=role,
    )


@router.delete("/users/{user_id}", status_code=204, response_model=None)
def delete_system_user(
    user_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> None:
    ensure_super_admin(db, staff)

    user = db.get(StaffUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Soft delete
    user.status = "DISABLED"
    db.flush()

    append_audit_log(
        db,
        tenant_id=None,
        event_id=None,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="staff_user",
        entity_id=user.id,
        action="DISABLE_BY_SUPER_ADMIN",
    )


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetOut)
def reset_system_user_password(
    user_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> PasswordResetOut:
    ensure_super_admin(db, staff)

    user = db.get(StaffUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    new_password = "".join(secrets.choice(alphabet) for _ in range(12))

    user.password_hash = hash_password(new_password)
    db.flush()

    append_audit_log(
        db,
        tenant_id=None,
        event_id=None,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="staff_user",
        entity_id=user.id,
        action="RESET_PASSWORD_BY_SUPER_ADMIN",
    )

    return PasswordResetOut(new_password=new_password)
