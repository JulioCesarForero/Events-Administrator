from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from domain.error_codes import (
    EVENT_NO_LAYOUT_BINDING,
    GROUP_ALREADY_RESERVED,
    INVALID_ALLOCATION,
    LEGAL_DOCUMENTS_NOT_PUBLISHED,
    NOT_FOUND,
    PAYMENT_NOT_APPROVED,
    RESERVATION_EXCEEDS_APPROVED_TICKETS,
    TABLE_CAPACITY_CONFLICT,
)
from domain.exceptions import ConflictError, NotFoundError, ValidationError
from infrastructure.persistence.models import (
    AttendeeGroup,
    EventLayoutBinding,
    EventPolicyDocument,
    LayoutTable,
    Participant,
    Payment,
    Reservation,
    ReservationCodeAssignment,
    ReservationConsent,
    TableReservation,
)

DATA_POLICY = "DATA_POLICY"
EVENT_TERMS = "EVENT_TERMS"


@dataclass
class TableAllocation:
    layout_table_id: UUID
    spots: int


def create_reservation(
    db: Session,
    *,
    event_id: UUID,
    group_id: UUID,
    payment_id: UUID,
    allocations: list[TableAllocation],
    policy_document_id: UUID,
    terms_document_id: UUID,
) -> Reservation:
    grp_check = db.get(AttendeeGroup, group_id)
    if grp_check and grp_check.reservation_status == "CONFIRMED":
        raise ConflictError("Group already has an active reservation", code=GROUP_ALREADY_RESERVED)

    pay = db.get(Payment, payment_id)
    if pay is None:
        raise NotFoundError("Payment not found", code=NOT_FOUND)
    if pay.event_id != event_id or pay.attendee_group_id != group_id:
        raise ValidationError("Payment does not belong to this group/event")
    if pay.status != "APPROVED":
        raise ConflictError("Payment must be approved before reserving", code=PAYMENT_NOT_APPROVED)

    total_spots = sum(a.spots for a in allocations)
    if total_spots != pay.ticket_quantity:
        raise ValidationError(
            "Total spots must match approved ticket quantity",
            code=RESERVATION_EXCEEDS_APPROVED_TICKETS,
        )

    pol = db.get(EventPolicyDocument, policy_document_id)
    terms = db.get(EventPolicyDocument, terms_document_id)
    if pol is None or terms is None:
        raise NotFoundError("Legal document not found")
    if pol.event_id != event_id or terms.event_id != event_id:
        raise ValidationError("Legal documents must belong to the event")
    if pol.document_type != DATA_POLICY or terms.document_type != EVENT_TERMS:
        raise ValidationError("Invalid document types for consent")
    if pol.status != "PUBLISHED" or terms.status != "PUBLISHED":
        raise ConflictError("Policy and terms must be published", code=LEGAL_DOCUMENTS_NOT_PUBLISHED)

    binding = db.execute(
        select(EventLayoutBinding)
        .where(EventLayoutBinding.event_id == event_id)
        .order_by(EventLayoutBinding.bound_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if binding is None:
        raise ConflictError("Event has no layout binding", code=EVENT_NO_LAYOUT_BINDING)

    table_ids = [a.layout_table_id for a in allocations]
    stmt = (
        select(LayoutTable)
        .where(
            LayoutTable.id.in_(table_ids),
            LayoutTable.layout_id == binding.layout_id,
        )
        .order_by(LayoutTable.id)
        .with_for_update()
    )
    rows = {r.id: r for r in db.execute(stmt).scalars()}

    if len(rows) != len(table_ids):
        raise ValidationError("One or more tables are not part of the event layout", code=INVALID_ALLOCATION)

    for a in sorted(allocations, key=lambda x: str(x.layout_table_id)):
        t = rows[a.layout_table_id]
        free = t.table_capacity_limit - t.current_occupied_spots
        if a.spots > free:
            raise ConflictError(f"Not enough capacity on table {t.code}", code=TABLE_CAPACITY_CONFLICT)

    res = Reservation(
        event_id=event_id,
        attendee_group_id=group_id,
        payment_id=payment_id,
        status="CONFIRMED",
        total_spots_reserved=total_spots,
    )
    db.add(res)
    db.flush()

    for a in allocations:
        t = rows[a.layout_table_id]
        db.add(
            TableReservation(
                reservation_id=res.id,
                event_id=event_id,
                attendee_group_id=group_id,
                layout_table_id=t.id,
                payment_id=payment_id,
                spots_reserved=a.spots,
                status="ACTIVE",
            )
        )
        t.current_occupied_spots += a.spots

    db.add(
        ReservationConsent(
            event_id=event_id,
            reservation_id=res.id,
            attendee_group_id=group_id,
            policy_document_id=policy_document_id,
            terms_document_id=terms_document_id,
            accepted_by_actor_type="BUYER",
            policy_version_label=pol.version_label,
            terms_version_label=terms.version_label,
        )
    )

    participants = list(
        db.execute(
            select(Participant).where(Participant.attendee_group_id == group_id)
        ).scalars()
    )
    if len(participants) != pay.ticket_quantity:
        raise ValidationError("Number of participants must match ticket quantity")

    seq_start: int | None = None
    seq_end: int | None = None
    for p in participants:
        seq = db.execute(
            text("SELECT events.fn_next_reservation_sequence_number(:eid)"),
            {"eid": event_id},
        ).scalar_one()
        if seq_start is None:
            seq_start = seq
        seq_end = seq
        code = f"R{seq:06d}"[:32]
        db.add(
            ReservationCodeAssignment(
                event_id=event_id,
                reservation_id=res.id,
                participant_id=p.id,
                reservation_code=code,
                code_sequence_number=seq,
            )
        )

    res.code_sequence_start = seq_start
    res.code_sequence_end = seq_end

    grp = db.get(AttendeeGroup, group_id)
    if grp:
        grp.reservation_status = "CONFIRMED"

    db.flush()
    return res


def release_reservation(db: Session, reservation_id: UUID, group_id: UUID) -> None:
    res = db.get(Reservation, reservation_id)
    if res is None:
        raise NotFoundError("Reservation not found")
    if res.attendee_group_id != group_id:
        raise ValidationError("Reservation does not belong to this group")
    if res.status != "CONFIRMED":
        raise ConflictError("Reservation already released")

    trs = list(
        db.execute(
            select(TableReservation).where(
                TableReservation.reservation_id == reservation_id,
                TableReservation.status == "ACTIVE",
            )
        ).scalars()
    )
    for tr in trs:
        t = db.get(LayoutTable, tr.layout_table_id)
        if t:
            t.current_occupied_spots = max(0, t.current_occupied_spots - tr.spots_reserved)
        tr.status = "RELEASED"
    res.status = "RELEASED"
    grp = db.get(AttendeeGroup, group_id)
    if grp:
        grp.reservation_status = "NONE"
    db.flush()


def move_reservation(
    db: Session,
    *,
    reservation_id: UUID,
    group_id: UUID,
    event_id: UUID,
    allocations: list[TableAllocation],
) -> Reservation:
    """Reassign tables/spots without regenerating reservation codes (same payment, same total spots)."""
    res = db.get(Reservation, reservation_id)
    if res is None:
        raise NotFoundError("Reservation not found")
    if res.attendee_group_id != group_id:
        raise ValidationError("Reservation does not belong to this group")
    if res.event_id != event_id:
        raise ValidationError("Reservation does not belong to this event")
    if res.status != "CONFIRMED":
        raise ConflictError("Only active reservations can be moved")

    old_trs = list(
        db.execute(
            select(TableReservation).where(
                TableReservation.reservation_id == reservation_id,
                TableReservation.status == "ACTIVE",
            )
        ).scalars()
    )
    if not old_trs:
        raise ConflictError("No active table lines for this reservation")

    old_total = sum(tr.spots_reserved for tr in old_trs)
    new_total = sum(a.spots for a in allocations)
    if old_total != new_total:
        raise ValidationError("Total spots must match the current reservation")

    binding = db.execute(
        select(EventLayoutBinding)
        .where(EventLayoutBinding.event_id == event_id)
        .order_by(EventLayoutBinding.bound_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if binding is None:
        raise ConflictError("Event has no layout binding")

    table_ids = {tr.layout_table_id for tr in old_trs} | {a.layout_table_id for a in allocations}
    stmt = (
        select(LayoutTable)
        .where(
            LayoutTable.id.in_(table_ids),
            LayoutTable.layout_id == binding.layout_id,
        )
        .order_by(LayoutTable.id)
        .with_for_update()
    )
    rows = {t.id: t for t in db.execute(stmt).scalars()}
    if len(rows) != len(table_ids):
        raise ValidationError("One or more tables are not part of the event layout")

    pay_id = old_trs[0].payment_id
    for tr in old_trs:
        t = rows.get(tr.layout_table_id)
        if t:
            t.current_occupied_spots = max(0, t.current_occupied_spots - tr.spots_reserved)
        tr.status = "MOVED"

    for a in sorted(allocations, key=lambda x: str(x.layout_table_id)):
        t = rows[a.layout_table_id]
        free = t.table_capacity_limit - t.current_occupied_spots
        if a.spots > free:
            raise ConflictError(f"Not enough capacity on table {t.code}")

    for a in allocations:
        t = rows[a.layout_table_id]
        db.add(
            TableReservation(
                reservation_id=res.id,
                event_id=event_id,
                attendee_group_id=group_id,
                layout_table_id=t.id,
                payment_id=pay_id,
                spots_reserved=a.spots,
                status="ACTIVE",
            )
        )
        t.current_occupied_spots += a.spots

    db.flush()
    return res
