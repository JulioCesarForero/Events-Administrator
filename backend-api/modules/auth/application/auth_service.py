from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from domain.exceptions import NotFoundError, ValidationError
from infrastructure.persistence.models import AttendeeGroup, StaffUser, StudentRecord
from infrastructure.security.jwt_tokens import create_buyer_token, create_staff_token
from infrastructure.security.password import verify_password


@dataclass
class StaffLoginResult:
    access_token: str
    user_id: UUID
    email: str


def staff_login(db: Session, email: str, password: str) -> StaffLoginResult:
    user = db.execute(select(StaffUser).where(StaffUser.email == email)).scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise ValidationError("Invalid credentials")
    token = create_staff_token(user_id=user.id, email=user.email)
    return StaffLoginResult(access_token=token, user_id=user.id, email=user.email)


@dataclass
class CodeLoginResult:
    access_token: str
    event_id: UUID
    group_id: UUID
    student_code: str
    is_first_use: bool
    reused_existing_group: bool


def code_login(db: Session, event_id: UUID, student_code: str) -> CodeLoginResult:
    rec = db.execute(
        select(StudentRecord).where(
            StudentRecord.event_id == event_id,
            StudentRecord.student_code == student_code,
            StudentRecord.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if rec is None:
        raise NotFoundError("Student code not found for this event")

    group = db.execute(
        select(AttendeeGroup).where(
            AttendeeGroup.event_id == event_id,
            AttendeeGroup.student_record_id == rec.id,
        )
    ).scalar_one_or_none()

    reused = group is not None
    is_first = False
    now = datetime.now(UTC)
    if group is None:
        display = f"{rec.first_name} {rec.last_name}".strip()
        group = AttendeeGroup(
            event_id=event_id,
            student_record_id=rec.id,
            student_code_snapshot=student_code,
            display_name=display or None,
            code_consumed_at=now,
        )
        db.add(group)
        db.flush()
        is_first = True
    else:
        if group.code_consumed_at is None:
            group.code_consumed_at = now
            is_first = True

    token = create_buyer_token(
        group_id=group.id, event_id=event_id, student_code=student_code
    )
    return CodeLoginResult(
        access_token=token,
        event_id=event_id,
        group_id=group.id,
        student_code=student_code,
        is_first_use=is_first,
        reused_existing_group=reused,
    )
