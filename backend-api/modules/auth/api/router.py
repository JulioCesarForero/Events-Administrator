from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import EmailStr, Field

from shared.api.schemas import CamelModel, CamelOrmModel
from sqlalchemy.orm import Session

from config.settings import settings
from infrastructure.persistence.models import StaffUser, UserTenantMembership
from infrastructure.security.password import hash_password
from modules.auth.application.auth_service import code_login, staff_login
from shared.api.deps import DbSession

router = APIRouter(prefix="/auth", tags=["auth"])


class StaffLoginRequest(CamelModel):
    email: EmailStr
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


class StaffRegisterRequest(CamelModel):
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
