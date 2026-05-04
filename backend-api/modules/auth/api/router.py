import logging
import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import AfterValidator, Field
from sqlalchemy import select

from config.settings import settings
from infrastructure.persistence.models import (
    StaffUser,
    Tenant,
    UserTenantMembership,
)
from infrastructure.security.jwt_tokens import create_staff_token
from infrastructure.security.password import hash_password
from modules.auth.application.auth_service import code_login, staff_login
from shared.api.deps import DbSession, StaffUserDep
from shared.api.schemas import CamelModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


class StaffLoginRequest(CamelModel):
    email: Email
    password: str = Field(min_length=1)


class StaffLoginResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    email: str


class CodeLoginRequest(CamelModel):
    event_id: UUID
    student_code: str = Field(min_length=1, max_length=128)


class CodeLoginResponse(CamelModel):
    session_token: str
    event_id: UUID
    group_id: UUID
    student_code: str
    is_first_use: bool
    reused_existing_group: bool


class StaffRegisterRequest(CamelModel):
    email: Email
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=200)
    tenant_id: UUID | None = None
    tenant_name: str | None = Field(default=None, min_length=1, max_length=200)


class StaffRegisterResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    email: str
    tenant_id: UUID


class TenantMembershipItem(CamelModel):
    tenant_id: UUID
    tenant_name: str
    role: str


class EventAssignmentItem(CamelModel):
    event_id: UUID
    event_name: str
    role: str


class StaffMeResponse(CamelModel):
    user_id: UUID
    email: str
    display_name: str
    status: str
    memberships: list[TenantMembershipItem]
    event_assignments: list[EventAssignmentItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/staff-login", response_model=StaffLoginResponse)
def post_staff_login(body: StaffLoginRequest, db: DbSession) -> StaffLoginResponse:
    r = staff_login(db, body.email, body.password)
    return StaffLoginResponse(
        access_token=r.access_token,
        user_id=r.user_id,
        email=r.email,
    )


@router.post("/code-login", response_model=CodeLoginResponse)
def post_code_login(body: CodeLoginRequest, db: DbSession) -> CodeLoginResponse:
    r = code_login(db, body.event_id, body.student_code)
    return CodeLoginResponse(
        session_token=r.access_token,
        event_id=r.event_id,
        group_id=r.group_id,
        student_code=r.student_code,
        is_first_use=r.is_first_use,
        reused_existing_group=r.reused_existing_group,
    )


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    return re.sub(r"[\s_-]+", "-", slug)[:80] or "default"


@router.post("/staff-register", response_model=StaffRegisterResponse)
def post_staff_register(body: StaffRegisterRequest, db: DbSession) -> StaffRegisterResponse:
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Not found")

    existing = db.execute(
        select(StaffUser).where(StaffUser.email == body.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Resolve tenant
    if body.tenant_id:
        tenant = db.get(Tenant, body.tenant_id)
        if tenant is None:
            raise HTTPException(status_code=404, detail="Tenant not found")
    else:
        tenant = db.execute(
            select(Tenant).where(Tenant.status == "ACTIVE").limit(1)
        ).scalar_one_or_none()
        if tenant is None:
            name = body.tenant_name or "Mi Organización"
            tenant = Tenant(name=name, slug=_slugify(name))
            db.add(tenant)
            db.flush()
            logger.info("Auto-created tenant %s (%s)", tenant.slug, tenant.id)

    user = StaffUser(
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()

    db.add(
        UserTenantMembership(
            tenant_id=tenant.id,
            user_id=user.id,
            role="ADMIN",
        )
    )
    db.flush()

    token = create_staff_token(user_id=user.id, email=user.email)
    return StaffRegisterResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        tenant_id=tenant.id,
    )


from infrastructure.persistence.models import Event, EventOrganizerAssignment


@router.get("/me", response_model=StaffMeResponse)
def get_me(staff: StaffUserDep, db: DbSession) -> StaffMeResponse:
    rows = db.execute(
        select(UserTenantMembership, Tenant)
        .join(Tenant, Tenant.id == UserTenantMembership.tenant_id)
        .where(UserTenantMembership.user_id == staff.id)
    ).all()

    memberships = [
        TenantMembershipItem(
            tenant_id=m.tenant_id,
            tenant_name=t.name,
            role=m.role,
        )
        for m, t in rows
    ]

    event_rows = db.execute(
        select(EventOrganizerAssignment, Event)
        .join(Event, Event.id == EventOrganizerAssignment.event_id)
        .where(EventOrganizerAssignment.user_id == staff.id)
    ).all()

    events = [
        EventAssignmentItem(
            event_id=a.event_id,
            event_name=e.name,
            role=a.role,
        )
        for a, e in event_rows
    ]

    return StaffMeResponse(
        user_id=staff.id,
        email=staff.email,
        display_name=staff.display_name,
        status=staff.status,
        memberships=memberships,
        event_assignments=events,
    )
