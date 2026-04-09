from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from config.settings import settings
from domain.exceptions import DomainError
from infrastructure.persistence.models import StaffUser, UserTenantMembership
from infrastructure.security.password import hash_password
from modules.auth.application.auth_service import code_login, staff_login
from shared.api.deps import DbSession
from shared.exceptions.http_map import domain_error_to_http

router = APIRouter(prefix="/auth", tags=["auth"])


class StaffLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class StaffLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    email: str


class CodeLoginRequest(BaseModel):
    event_id: UUID
    student_code: str = Field(min_length=1, max_length=128)


class CodeLoginResponse(BaseModel):
    session_token: str
    event_id: UUID
    group_id: UUID
    student_code: str
    is_first_use: bool
    reused_existing_group: bool


@router.post("/staff-login", response_model=StaffLoginResponse)
def post_staff_login(body: StaffLoginRequest, db: DbSession) -> StaffLoginResponse:
    try:
        r = staff_login(db, body.email, body.password)
    except DomainError as e:
        raise domain_error_to_http(e) from e
    return StaffLoginResponse(
        access_token=r.access_token,
        user_id=r.user_id,
        email=r.email,
    )


@router.post("/code-login", response_model=CodeLoginResponse)
def post_code_login(body: CodeLoginRequest, db: DbSession) -> CodeLoginResponse:
    try:
        r = code_login(db, body.event_id, body.student_code)
    except DomainError as e:
        raise domain_error_to_http(e) from e
    return CodeLoginResponse(
        session_token=r.access_token,
        event_id=r.event_id,
        group_id=r.group_id,
        student_code=r.student_code,
        is_first_use=r.is_first_use,
        reused_existing_group=r.reused_existing_group,
    )


class StaffRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=200)
    tenant_id: UUID


@router.post("/staff-register")
def post_staff_register(body: StaffRegisterRequest, db: DbSession) -> dict:
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Not found")
    from sqlalchemy import select

    existing = db.execute(select(StaffUser).where(StaffUser.email == body.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = StaffUser(
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()
    db.add(
        UserTenantMembership(
            tenant_id=body.tenant_id,
            user_id=user.id,
            role="ADMIN",
        )
    )
    return {"id": str(user.id), "email": user.email}
