from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from domain.error_codes import INVALID_PAYLOAD, NOT_FOUND
from domain.exceptions import ConflictError, NotFoundError, ValidationError
from infrastructure.persistence.models import AttendeeGroup, StudentRecord


def get_student(db: Session, event_id: UUID, student_id: UUID) -> StudentRecord:
    rec = db.get(StudentRecord, student_id)
    if rec is None or rec.event_id != event_id:
        raise NotFoundError("Student record not found", code=NOT_FOUND)
    return rec


def list_students(
    db: Session,
    event_id: UUID,
    *,
    search: str | None = None,
    is_active: bool | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[StudentRecord], int]:
    base = select(StudentRecord).where(StudentRecord.event_id == event_id)

    if is_active is not None:
        base = base.where(StudentRecord.is_active == is_active)

    if search:
        pattern = f"%{search}%"
        base = base.where(
            StudentRecord.student_code.ilike(pattern)
            | StudentRecord.first_name.ilike(pattern)
            | StudentRecord.last_name.ilike(pattern)
        )

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()

    rows = list(
        db.execute(
            base.order_by(StudentRecord.last_name, StudentRecord.first_name)
            .offset(offset)
            .limit(limit)
        ).scalars()
    )
    return rows, total


def update_student(
    db: Session,
    event_id: UUID,
    student_id: UUID,
    *,
    student_code: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    is_active: bool | None = None,
) -> StudentRecord:
    rec = get_student(db, event_id, student_id)

    if student_code is not None and student_code != rec.student_code:
        dup = db.execute(
            select(StudentRecord).where(
                StudentRecord.event_id == event_id,
                StudentRecord.student_code == student_code,
                StudentRecord.id != student_id,
            )
        ).scalar_one_or_none()
        if dup:
            raise ConflictError(
                f"Student code '{student_code}' already exists for this event",
                code=INVALID_PAYLOAD,
            )
        rec.student_code = student_code

    if first_name is not None:
        rec.first_name = first_name
    if last_name is not None:
        rec.last_name = last_name
    if is_active is not None:
        rec.is_active = is_active

    db.flush()
    return rec


def delete_student(db: Session, event_id: UUID, student_id: UUID) -> None:
    rec = get_student(db, event_id, student_id)

    has_group = db.execute(
        select(AttendeeGroup.id).where(
            AttendeeGroup.student_record_id == rec.id,
        )
    ).first()
    if has_group:
        raise ValidationError(
            "Cannot delete a student that already has an attendee group; "
            "deactivate instead",
            code=INVALID_PAYLOAD,
        )

    db.delete(rec)
    db.flush()
