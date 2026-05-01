from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from config.settings import settings
from infrastructure.persistence.database import get_db
from infrastructure.persistence.models import (
    Event,
    EventOrganizerAssignment,
    StaffUser,
    UserTenantMembership,
)
from infrastructure.security.jwt_tokens import decode_token

security_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


async def get_current_staff(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)],
    db: DbSession,
) -> StaffUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = decode_token(creds.credentials, settings.jwt_staff_audience)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(StaffUser, UUID(uid))
    if user is None or user.status != "ACTIVE":
        raise HTTPException(status_code=401, detail="User not found")
    request.state.staff_user_id = user.id
    return user


async def get_current_buyer(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)],
) -> dict:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = decode_token(creds.credentials, settings.jwt_buyer_audience)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e
    if payload.get("typ") != "buyer":
        raise HTTPException(status_code=403, detail="Not a buyer session")
    return payload


StaffUserDep = Annotated[StaffUser, Depends(get_current_staff)]
BuyerClaimsDep = Annotated[dict, Depends(get_current_buyer)]


from shared.api.authz import Permission, get_role_permissions


def has_event_permission(db: Session, staff: StaffUser, event_id: UUID, permission: Permission) -> Event:
    ev = db.get(Event, event_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check if user has an event assignment that grants the permission
    org = db.execute(
        select(EventOrganizerAssignment).where(
            EventOrganizerAssignment.event_id == event_id,
            EventOrganizerAssignment.user_id == staff.id,
        )
    ).scalar_one_or_none()
    
    if org is not None:
        perms = get_role_permissions(org.role)
        if permission in perms:
            return ev

    # Check if user has a tenant membership that grants the permission
    m = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == staff.id,
            UserTenantMembership.tenant_id == ev.tenant_id,
        )
    ).scalar_one_or_none()
    
    if m is not None:
        perms = get_role_permissions(m.role)
        if permission in perms:
            return ev

    raise HTTPException(status_code=403, detail="Not allowed for this event or insufficient permissions")


def ensure_event_staff_access(db: Session, staff: StaffUser, event_id: UUID) -> Event:
    """Legacy compatibility: just ensures they have some assignment or tenant membership."""
    ev = db.get(Event, event_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    org = db.execute(
        select(EventOrganizerAssignment).where(
            EventOrganizerAssignment.event_id == event_id,
            EventOrganizerAssignment.user_id == staff.id,
        )
    ).scalar_one_or_none()
    if org is not None:
        return ev
    m = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == staff.id,
            UserTenantMembership.tenant_id == ev.tenant_id,
        )
    ).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=403, detail="Not allowed for this event")
    return ev


def ensure_event_payment_access(db: DbSession, staff: StaffUserDep, event_id: UUID) -> Event:
    return has_event_permission(db, staff, event_id, Permission.MANAGE_PAYMENTS)


def ensure_event_viewer_access(db: DbSession, staff: StaffUserDep, event_id: UUID) -> Event:
    return has_event_permission(db, staff, event_id, Permission.VIEW_STUDENTS)


def ensure_event_manager_access(db: DbSession, staff: StaffUserDep, event_id: UUID) -> Event:
    return has_event_permission(db, staff, event_id, Permission.MANAGE_EVENT)

def ensure_event_student_manager_access(db: DbSession, staff: StaffUserDep, event_id: UUID) -> Event:
    return has_event_permission(db, staff, event_id, Permission.MANAGE_STUDENTS)


TENANT_ADMIN_ROLES = ("ADMIN", "OWNER", "TENANT_ADMIN", "SUPER_ADMIN")


def ensure_tenant_admin(
    db: Session, staff: StaffUser, tenant_id: UUID
) -> UserTenantMembership | None:
    # First check if the user is a SUPER_ADMIN globally
    global_super_admin = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == staff.id,
            UserTenantMembership.role == "SUPER_ADMIN",
        )
    ).scalar_one_or_none()
    
    if global_super_admin:
        return global_super_admin

    # Otherwise, check specific tenant membership
    m = db.execute(
        select(UserTenantMembership).where(
            UserTenantMembership.user_id == staff.id,
            UserTenantMembership.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    
    if m is None or m.role not in TENANT_ADMIN_ROLES:
        raise HTTPException(
            status_code=403, detail="Tenant admin role required"
        )
    return m


def buyer_group_id(claims: dict) -> UUID:
    return UUID(claims["sub"])


def buyer_event_id(claims: dict) -> UUID:
    return UUID(claims["event_id"])
