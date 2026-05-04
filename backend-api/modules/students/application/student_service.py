from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from domain.error_codes import INVALID_PAYLOAD, NOT_FOUND
from domain.exceptions import ConflictError, NotFoundError, ValidationError
from infrastructure.persistence.models import (
    AttendeeGroup,
    Payment,
    Reservation,
    StudentRecord,
    TableReservation,
)


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
            "Cannot delete a student that already has an attendee group; deactivate instead",
            code=INVALID_PAYLOAD,
        )

    db.delete(rec)
    db.flush()


def get_students_summary(
    db: Session,
    event_id: UUID,
    *,
    search: str | None = None,
    payment_status: str | None = None,
    has_reservation: bool | None = None,
    is_inconsistent: bool | None = None,
) -> list[dict]:
    # CTEs / Subqueries for Aggregation

    payments_sq = (
        select(
            Payment.attendee_group_id,
            func.coalesce(func.sum(Payment.ticket_quantity), 0).label("reported"),
            func.coalesce(
                func.sum(Payment.ticket_quantity).filter(Payment.status == "APPROVED"), 0
            ).label("approved"),
            func.coalesce(
                func.sum(Payment.ticket_quantity).filter(Payment.status == "PENDING_APPROVAL"), 0
            ).label("pending"),
            func.coalesce(
                func.sum(Payment.ticket_quantity).filter(Payment.status == "REJECTED"), 0
            ).label("rejected"),
        )
        .where(Payment.event_id == event_id, Payment.status != "DRAFT")
        .group_by(Payment.attendee_group_id)
        .subquery()
    )

    reservations_sq = (
        select(
            Reservation.attendee_group_id,
            func.count(Reservation.id).filter(Reservation.status == "CONFIRMED").label("count"),
        )
        .where(Reservation.event_id == event_id)
        .group_by(Reservation.attendee_group_id)
        .subquery()
    )

    table_res_sq = (
        select(
            TableReservation.attendee_group_id,
            func.coalesce(func.sum(TableReservation.spots_reserved), 0).label("spots"),
        )
        .where(TableReservation.event_id == event_id, TableReservation.status == "ACTIVE")
        .group_by(TableReservation.attendee_group_id)
        .subquery()
    )

    stmt = (
        select(
            AttendeeGroup.id.label("attendee_group_id"),
            StudentRecord.id.label("student_record_id"),
            StudentRecord.student_code,
            func.coalesce(
                AttendeeGroup.display_name, StudentRecord.first_name + " " + StudentRecord.last_name
            ).label("display_name"),
            StudentRecord.first_name,
            StudentRecord.last_name,
            func.coalesce(payments_sq.c.reported, 0).label("reported"),
            func.coalesce(payments_sq.c.approved, 0).label("approved"),
            func.coalesce(payments_sq.c.pending, 0).label("pending"),
            func.coalesce(payments_sq.c.rejected, 0).label("rejected"),
            func.coalesce(reservations_sq.c.count, 0).label("res_count"),
            func.coalesce(table_res_sq.c.spots, 0).label("res_spots"),
        )
        .select_from(StudentRecord)
        .outerjoin(AttendeeGroup, StudentRecord.id == AttendeeGroup.student_record_id)
        .outerjoin(payments_sq, AttendeeGroup.id == payments_sq.c.attendee_group_id)
        .outerjoin(reservations_sq, AttendeeGroup.id == reservations_sq.c.attendee_group_id)
        .outerjoin(table_res_sq, AttendeeGroup.id == table_res_sq.c.attendee_group_id)
        .where(StudentRecord.event_id == event_id)
    )

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            StudentRecord.student_code.ilike(pattern)
            | StudentRecord.first_name.ilike(pattern)
            | StudentRecord.last_name.ilike(pattern)
        )

    if payment_status == "PENDING_APPROVAL":
        stmt = stmt.where(func.coalesce(payments_sq.c.pending, 0) > 0)
    elif payment_status == "APPROVED":
        stmt = stmt.where(func.coalesce(payments_sq.c.approved, 0) > 0)

    if has_reservation is True:
        stmt = stmt.where(func.coalesce(reservations_sq.c.count, 0) > 0)
    elif has_reservation is False:
        stmt = stmt.where(func.coalesce(reservations_sq.c.count, 0) == 0)

    if is_inconsistent is True:
        stmt = stmt.where(
            func.coalesce(table_res_sq.c.spots, 0) > func.coalesce(payments_sq.c.approved, 0)
        )

    stmt = stmt.order_by(StudentRecord.last_name.asc(), StudentRecord.first_name.asc())

    rows = db.execute(stmt).all()

    results = []
    for row in rows:
        tickets_approved = row.approved
        spots = row.res_spots
        tickets_pending = row.pending

        results.append(
            {
                "attendeeGroupId": str(row.attendee_group_id) if row.attendee_group_id else None,
                "studentRecordId": str(row.student_record_id),
                "studentCode": row.student_code,
                "studentName": row.display_name,
                "firstName": row.first_name,
                "lastName": row.last_name,
                "tickets": {
                    "reported": row.reported,
                    "approved": tickets_approved,
                    "pending": tickets_pending,
                    "rejected": row.rejected,
                },
                "reservations": {"count": row.res_count, "spotsReserved": spots},
                "flags": {
                    "hasApprovedPayment": tickets_approved > 0,
                    "canReserve": tickets_approved > 0,
                    "isOverbooked": spots > tickets_approved,
                    "pendingAction": tickets_pending > 0,
                },
            }
        )
    return results
