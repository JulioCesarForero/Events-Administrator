"""Staff APIs: search/detail for buyer groups, admin participant edits, reservation release/move."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import datetime, timezone
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import Field
from sqlalchemy import String, cast as sql_cast, exists, func, or_, select
from sqlalchemy.orm import Session

from domain.error_codes import INVALID_PAYLOAD, PARTICIPANT_LIMIT_EXCEEDED, RESERVATION_EXCEEDS_APPROVED_TICKETS
from domain.exceptions import ConflictError, NotFoundError, ValidationError
from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import (
    AttendeeGroup,
    AuditLog,
    Event,
    EventConfiguration,
    LayoutTable,
    Participant,
    Payment,
    Reservation,
    ReservationCodeAssignment,
    StaffUser,
    StudentRecord,
    TableReservation,
)
from infrastructure.persistence.views import event_reservation_summary, participant_reservation_codes
from modules.attendees.api.router import MyGroupOut, MyGroupPaymentOut, _effective_group_payment
from modules.payments.application.stage_capacity import (
    current_max_participants_per_group,
    latest_approved_payment_id,
    sum_approved_tickets_for_group,
    sum_confirmed_reservation_spots,
)
from modules.reservations.api.router import AllocationIn, _build_reservation_out, _serialize_reservation
from modules.reservations.application.reservation_service import (
    TableAllocation,
    move_reservation,
    release_reservation,
)
from shared.api.deps import (
    DbSession,
    StaffUserDep,
    ensure_event_staff_access,
    ensure_super_admin,
    has_event_permission,
)
from shared.api.authz import Permission
from shared.api.schemas import CamelModel, CamelOrmModel

router = APIRouter(prefix="/events", tags=["staff-event-groups"])


def _require_view_students(db: Session, staff: StaffUser, event_id: UUID) -> Event:
    return has_event_permission(db, staff, event_id, Permission.VIEW_STUDENTS)


def _require_manage_students(db: Session, staff: StaffUser, event_id: UUID) -> Event:
    return has_event_permission(db, staff, event_id, Permission.MANAGE_STUDENTS)


class StaffGroupSearchRowOut(CamelModel):
    group_id: UUID
    event_id: UUID
    student_code_snapshot: str
    display_name: str | None
    reservation_status: str
    approved_ticket_count: int
    active_spots_reserved: int
    available_reservation_balance: int
    current_payment_status: str | None = None


class ParticipantStaffOut(CamelOrmModel):
    id: UUID
    attendee_group_id: UUID
    first_name: str
    last_name: str
    document_type: str
    document_id: str
    is_vegetarian: bool
    allergies: str
    mobile_phone: str
    emergency_contact_name: str
    emergency_contact_phone: str
    has_reduced_mobility: bool


class PaymentSummaryOut(CamelOrmModel):
    id: UUID
    status: str
    ticket_quantity: int
    payment_type: str


class TableReservationLineOut(CamelModel):
    id: UUID
    layout_table_id: UUID
    table_code: str | None = None
    spots_reserved: int
    status: str


class ReservationStaffDetailOut(CamelModel):
    reservation_id: UUID
    status: str
    total_spots_reserved: int
    payment_id: UUID
    created_at: datetime | None = None
    lines: list[TableReservationLineOut]


class ReservationCodeStaffOut(CamelModel):
    participant_id: UUID
    reservation_id: UUID
    reservation_code: str
    code_sequence_number: int


class StaffGroupDetailOut(CamelModel):
    summary: MyGroupOut
    participants: list[ParticipantStaffOut]
    payments: list[PaymentSummaryOut]
    reservations: list[ReservationStaffDetailOut]
    reservation_codes: list[ReservationCodeStaffOut]


class StaffReasonBody(CamelModel):
    reason: str = Field(min_length=3, max_length=2000)


class StaffParticipantFieldsPatch(CamelModel):
    first_name: str | None = Field(default=None, max_length=200)
    last_name: str | None = Field(default=None, max_length=200)
    document_type: str | None = Field(default=None, max_length=32)
    document_id: str | None = Field(default=None, max_length=64)
    is_vegetarian: bool | None = None
    allergies: str | None = None
    mobile_phone: str | None = Field(default=None, max_length=32)
    emergency_contact_name: str | None = Field(default=None, max_length=200)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    has_reduced_mobility: bool | None = None


class StaffParticipantPatchBody(CamelModel):
    reason: str = Field(min_length=3, max_length=2000)
    fields: StaffParticipantFieldsPatch


class StaffParticipantCreateIn(CamelModel):
    first_name: str = Field(max_length=200)
    last_name: str = Field(max_length=200)
    document_type: str = Field(max_length=32)
    document_id: str = Field(max_length=64)
    is_vegetarian: bool = False
    allergies: str = ""
    mobile_phone: str = Field(max_length=32)
    emergency_contact_name: str = Field(max_length=200)
    emergency_contact_phone: str = Field(max_length=32)
    has_reduced_mobility: bool = False


class StaffParticipantCreateBody(CamelModel):
    reason: str = Field(min_length=3, max_length=2000)
    participant: StaffParticipantCreateIn


class StaffReservationMoveBody(CamelModel):
    reason: str = Field(min_length=3, max_length=2000)
    allocations: list[AllocationIn]


class VenueAttendeeRowOut(CamelModel):
    participant_id: UUID
    attendee_group_id: UUID
    student_code_snapshot: str
    display_name: str | None
    reservation_code: str | None = None
    reservation_id: UUID | None = None
    reservation_status: str | None = None
    table_codes: list[str] = Field(default_factory=list)
    table_codes_display: str = ""
    has_active_seating: bool = False
    first_name: str
    last_name: str
    document_type: str
    document_id: str
    is_vegetarian: bool
    allergies: str
    mobile_phone: str
    emergency_contact_name: str
    emergency_contact_phone: str
    has_reduced_mobility: bool


class VenueGroupReportOut(CamelModel):
    group_id: UUID
    student_code_snapshot: str
    display_name: str | None
    participants: list[VenueAttendeeRowOut]


class VenueReportTotalsOut(CamelModel):
    total_participants: int
    total_with_active_seating: int
    total_without_assignment: int
    total_spots_confirmed: int | None = None


class VenueReportOut(CamelModel):
    event_id: UUID
    generated_at: datetime
    include_non_active: bool
    totals: VenueReportTotalsOut
    groups: list[VenueGroupReportOut]


class PaymentApprovalRowOut(CamelModel):
    payment_id: UUID
    attendee_group_id: UUID
    student_code_snapshot: str | None = None
    display_name: str | None = None
    payment_type: str
    status: str
    ticket_quantity: int
    amount_cents: int | None = None
    currency: str | None = None
    submitted_at: datetime | None = None
    approved_at: datetime | None = None
    approved_by_user_id: UUID | None = None
    approved_by_display_name: str | None = None
    approved_by_email: str | None = None
    responsible_collection: str | None = None


class PaymentApproverSummaryOut(CamelModel):
    approver_user_id: UUID | None = None
    approver_display_name: str | None = None
    approver_email: str | None = None
    approved_payments_count: int
    approved_amount_by_currency: dict[str, int]


class PaymentApprovalTotalsOut(CamelModel):
    approved_payments_count: int
    approved_tickets_count: int
    approved_amount_by_currency: dict[str, int]
    missing_approved_amount_count: int
    pending_payments_count: int
    rejected_payments_count: int
    draft_payments_count: int


class PaymentApprovalReportOut(CamelModel):
    event_id: UUID
    generated_at: datetime
    totals: PaymentApprovalTotalsOut
    rows: list[PaymentApprovalRowOut]
    approvers: list[PaymentApproverSummaryOut]


class AuditLogStaffOut(CamelOrmModel):
    id: UUID
    occurred_at: datetime
    actor_type: str
    entity_type: str
    entity_id: UUID | None
    action: str
    payload_json: dict[str, Any] | None


def _my_group_out(db: Session, event_id: UUID, g: AttendeeGroup) -> MyGroupOut:
    ev = db.get(Event, event_id)
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    wf: Payment | None = db.get(Payment, g.current_payment_id) if g.current_payment_id else None
    pay = wf if wf is not None else _effective_group_payment(db, g)
    payment_out = None
    if pay is not None:
        payment_out = MyGroupPaymentOut(
            id=pay.id,
            status=pay.status,
            ticket_quantity=pay.ticket_quantity,
            payment_type=pay.payment_type,
            rejection_reason=pay.rejection_reason,
            submitted_at=pay.submitted_at,
            approved_at=pay.approved_at,
            rejected_at=pay.rejected_at,
        )
    approved_sum = sum_approved_tickets_for_group(db, g.id, event_id)
    active_reserved = sum_confirmed_reservation_spots(db, g.id, event_id)
    available_balance = max(0, approved_sum - active_reserved)
    last_appr = latest_approved_payment_id(db, g.id, event_id)
    max_participants = current_max_participants_per_group(cfg) if cfg is not None else 4
    return MyGroupOut(
        group_id=g.id,
        event_id=g.event_id,
        student_code_snapshot=g.student_code_snapshot,
        display_name=g.display_name,
        reservation_status=g.reservation_status,
        approved_ticket_count=approved_sum,
        active_spots_reserved=active_reserved,
        available_reservation_balance=available_balance,
        current_payment_id=g.current_payment_id,
        latest_approved_payment_id=last_appr,
        current_payment=payment_out,
        event_date=ev.event_date if ev else None,
        timezone=cfg.timezone if cfg else None,
        ticket_price=cfg.ticket_price if cfg else 50000,
        payment_instructions=cfg.payment_instructions if cfg else None,
        max_participants_allowed=max_participants,
    )


def _load_group_in_event(db: Session, event_id: UUID, group_id: UUID) -> AttendeeGroup:
    g = db.get(AttendeeGroup, group_id)
    if g is None or g.event_id != event_id:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


def _table_code_map(db: Session, layout_table_ids: set[UUID]) -> dict[UUID, str | None]:
    if not layout_table_ids:
        return {}
    rows = (
        db.execute(select(LayoutTable.id, LayoutTable.code).where(LayoutTable.id.in_(layout_table_ids)))
        .all()
    )
    return {rid: code for rid, code in rows}


def _build_venue_report(
    db: Session, event_id: UUID, *, include_non_active: bool
) -> VenueReportOut:
    groups = list(
        db.execute(
            select(AttendeeGroup)
            .where(AttendeeGroup.event_id == event_id)
            .order_by(AttendeeGroup.student_code_snapshot.asc())
        )
        .scalars()
        .all()
    )
    if not groups:
        summary = event_reservation_summary(db, event_id)
        spots = int(summary["total_spots_confirmed"]) if summary else None
        return VenueReportOut(
            event_id=event_id,
            generated_at=datetime.now(timezone.utc),
            include_non_active=include_non_active,
            totals=VenueReportTotalsOut(
                total_participants=0,
                total_with_active_seating=0,
                total_without_assignment=0,
                total_spots_confirmed=spots,
            ),
            groups=[],
        )

    group_ids = [g.id for g in groups]
    participants = list(
        db.execute(
            select(Participant)
            .where(Participant.attendee_group_id.in_(group_ids))
            .order_by(Participant.attendee_group_id, Participant.id)
        )
        .scalars()
        .all()
    )
    participant_ids = [p.id for p in participants]

    rca_rows: list[ReservationCodeAssignment] = []
    if participant_ids:
        rca_rows = list(
            db.execute(
                select(ReservationCodeAssignment).where(
                    ReservationCodeAssignment.event_id == event_id,
                    ReservationCodeAssignment.participant_id.in_(participant_ids),
                )
            )
            .scalars()
            .all()
        )

    rca_by_participant: dict[UUID, ReservationCodeAssignment] = {}
    for rca in rca_rows:
        rca_by_participant[rca.participant_id] = rca

    res_ids = {rca.reservation_id for rca in rca_rows}
    reservations: dict[UUID, Reservation] = {}
    if res_ids:
        for r in db.execute(select(Reservation).where(Reservation.id.in_(res_ids))).scalars():
            reservations[r.id] = r

    tr_by_res: dict[UUID, list[TableReservation]] = defaultdict(list)
    table_ids: set[UUID] = set()
    if res_ids:
        for tr in db.execute(
            select(TableReservation).where(
                TableReservation.event_id == event_id,
                TableReservation.reservation_id.in_(res_ids),
            )
        ).scalars():
            tr_by_res[tr.reservation_id].append(tr)
            table_ids.add(tr.layout_table_id)

    code_by_table = _table_code_map(db, table_ids)

    def _table_codes_for_reservation(res_id: UUID) -> list[str]:
        res = reservations.get(res_id)
        if res is None or res.status != "CONFIRMED":
            return []
        codes: list[str] = []
        for tr in tr_by_res.get(res_id, []):
            if tr.status != "ACTIVE":
                continue
            c = code_by_table.get(tr.layout_table_id)
            codes.append(c if c else str(tr.layout_table_id))
        return sorted(set(codes))

    def _has_active_seating(participant_id: UUID) -> bool:
        rca = rca_by_participant.get(participant_id)
        if rca is None:
            return False
        res = reservations.get(rca.reservation_id)
        if res is None or res.status != "CONFIRMED":
            return False
        return any(tr.status == "ACTIVE" for tr in tr_by_res.get(rca.reservation_id, []))

    group_by_id = {g.id: g for g in groups}

    def _row_for_participant(p: Participant) -> VenueAttendeeRowOut:
        g = group_by_id[p.attendee_group_id]
        rca = rca_by_participant.get(p.id)
        res_st: str | None = None
        res_id: UUID | None = None
        code: str | None = None
        tc: list[str] = []
        if rca:
            res_id = rca.reservation_id
            code = rca.reservation_code
            res_o = reservations.get(rca.reservation_id)
            res_st = res_o.status if res_o else None
            tc = _table_codes_for_reservation(rca.reservation_id)
        active = _has_active_seating(p.id)
        disp = "; ".join(tc)
        return VenueAttendeeRowOut(
            participant_id=p.id,
            attendee_group_id=p.attendee_group_id,
            student_code_snapshot=g.student_code_snapshot,
            display_name=g.display_name,
            reservation_code=code,
            reservation_id=res_id,
            reservation_status=res_st,
            table_codes=tc,
            table_codes_display=disp,
            has_active_seating=active,
            first_name=p.first_name,
            last_name=p.last_name,
            document_type=p.document_type,
            document_id=p.document_id,
            is_vegetarian=p.is_vegetarian,
            allergies=p.allergies,
            mobile_phone=p.mobile_phone,
            emergency_contact_name=p.emergency_contact_name,
            emergency_contact_phone=p.emergency_contact_phone,
            has_reduced_mobility=p.has_reduced_mobility,
        )

    all_rows = [_row_for_participant(p) for p in participants]

    def _include_row(row: VenueAttendeeRowOut) -> bool:
        if include_non_active:
            return True
        if row.has_active_seating:
            return True
        if row.reservation_code is None:
            return True
        return False

    filtered = [r for r in all_rows if _include_row(r)]

    groups_out: list[VenueGroupReportOut] = []
    for g in groups:
        g_rows = [r for r in filtered if r.attendee_group_id == g.id]
        if not g_rows:
            continue
        groups_out.append(
            VenueGroupReportOut(
                group_id=g.id,
                student_code_snapshot=g.student_code_snapshot,
                display_name=g.display_name,
                participants=g_rows,
            )
        )

    total_with_active = sum(1 for r in all_rows if r.has_active_seating)
    total_no_assign = sum(1 for r in all_rows if r.reservation_code is None)

    summary = event_reservation_summary(db, event_id)
    spots = int(summary["total_spots_confirmed"]) if summary else None

    return VenueReportOut(
        event_id=event_id,
        generated_at=datetime.now(timezone.utc),
        include_non_active=include_non_active,
        totals=VenueReportTotalsOut(
            total_participants=len(participants),
            total_with_active_seating=total_with_active,
            total_without_assignment=total_no_assign,
            total_spots_confirmed=spots,
        ),
        groups=groups_out,
    )


def _venue_report_to_csv(report: VenueReportOut) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\r\n")
    w.writerow(
        [
            "codigo_estudiante",
            "nombre_display",
            "codigo_reserva",
            "estado_reserva",
            "mesas",
            "tiene_ubicacion_activa",
            "nombre",
            "apellido",
            "tipo_documento",
            "documento",
            "telefono",
            "alergias",
            "vegetariano",
            "movilidad_reducida",
            "contacto_emergencia",
            "telefono_emergencia",
        ]
    )
    for grp in report.groups:
        w.writerow([f"--- Grupo {grp.student_code_snapshot} ---", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])
        for r in grp.participants:
            w.writerow(
                [
                    r.student_code_snapshot,
                    r.display_name or "",
                    r.reservation_code or "",
                    r.reservation_status or "",
                    r.table_codes_display,
                    "si" if r.has_active_seating else "no",
                    r.first_name,
                    r.last_name,
                    r.document_type,
                    r.document_id,
                    r.mobile_phone,
                    r.allergies,
                    "si" if r.is_vegetarian else "no",
                    "si" if r.has_reduced_mobility else "no",
                    r.emergency_contact_name,
                    r.emergency_contact_phone,
                ]
            )
        w.writerow([])
    w.writerow([])
    w.writerow(
        [
            "TOTALES",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ]
    )
    w.writerow(
        [
            "total_participantes_evento",
            str(report.totals.total_participants),
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ]
    )
    w.writerow(
        [
            "con_ubicacion_activa",
            str(report.totals.total_with_active_seating),
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ]
    )
    w.writerow(
        [
            "sin_codigo_reserva",
            str(report.totals.total_without_assignment),
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ]
    )
    w.writerow(
        [
            "cupos_confirmados_bd",
            str(report.totals.total_spots_confirmed if report.totals.total_spots_confirmed is not None else ""),
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ]
    )
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def _build_payment_approval_report(db: Session, event_id: UUID) -> PaymentApprovalReportOut:
    groups = list(
        db.execute(
            select(AttendeeGroup)
            .where(AttendeeGroup.event_id == event_id)
            .order_by(AttendeeGroup.student_code_snapshot.asc())
        )
        .scalars()
        .all()
    )
    group_by_id = {g.id: g for g in groups}

    payments = list(
        db.execute(
            select(Payment)
            .where(Payment.event_id == event_id)
            .order_by(Payment.approved_at.desc(), Payment.created_at.desc())
        )
        .scalars()
        .all()
    )

    approver_ids = {p.reviewed_by_user_id for p in payments if p.reviewed_by_user_id is not None}
    approvers_by_id: dict[UUID, StaffUser] = {}
    if approver_ids:
        for u in db.execute(select(StaffUser).where(StaffUser.id.in_(approver_ids))).scalars():
            approvers_by_id[u.id] = u

    rows: list[PaymentApprovalRowOut] = []
    approved_amount_by_currency: dict[str, int] = defaultdict(int)
    approved_tickets_count = 0
    missing_approved_amount_count = 0
    pending_count = 0
    rejected_count = 0
    draft_count = 0
    approved_count = 0
    approver_rollup: dict[UUID | None, PaymentApproverSummaryOut] = {}

    for p in payments:
        if p.status == "PENDING_APPROVAL":
            pending_count += 1
        elif p.status == "REJECTED":
            rejected_count += 1
        elif p.status == "DRAFT":
            draft_count += 1

        if p.status != "APPROVED":
            continue

        approved_count += 1
        approved_tickets_count += p.ticket_quantity
        if p.amount_cents is None:
            missing_approved_amount_count += 1
        else:
            approved_amount_by_currency[p.currency or "UNKNOWN"] += int(p.amount_cents)

        g = group_by_id.get(p.attendee_group_id)
        approver = approvers_by_id.get(p.reviewed_by_user_id) if p.reviewed_by_user_id else None
        responsible = approver.display_name if approver else "SIN_APROBADOR_REGISTRADO"

        rows.append(
            PaymentApprovalRowOut(
                payment_id=p.id,
                attendee_group_id=p.attendee_group_id,
                student_code_snapshot=g.student_code_snapshot if g else None,
                display_name=g.display_name if g else None,
                payment_type=p.payment_type,
                status=p.status,
                ticket_quantity=p.ticket_quantity,
                amount_cents=p.amount_cents,
                currency=p.currency,
                submitted_at=p.submitted_at,
                approved_at=p.approved_at,
                approved_by_user_id=p.reviewed_by_user_id,
                approved_by_display_name=approver.display_name if approver else None,
                approved_by_email=approver.email if approver else None,
                responsible_collection=responsible,
            )
        )

        key = p.reviewed_by_user_id
        if key not in approver_rollup:
            approver_rollup[key] = PaymentApproverSummaryOut(
                approver_user_id=key,
                approver_display_name=approver.display_name if approver else None,
                approver_email=approver.email if approver else None,
                approved_payments_count=0,
                approved_amount_by_currency={},
            )
        roll = approver_rollup[key]
        roll.approved_payments_count += 1
        if p.amount_cents is not None:
            c = p.currency or "UNKNOWN"
            roll.approved_amount_by_currency[c] = roll.approved_amount_by_currency.get(c, 0) + int(
                p.amount_cents
            )

    approver_summaries = sorted(
        approver_rollup.values(),
        key=lambda x: (x.approver_display_name or "", x.approved_payments_count),
        reverse=True,
    )

    return PaymentApprovalReportOut(
        event_id=event_id,
        generated_at=datetime.now(timezone.utc),
        totals=PaymentApprovalTotalsOut(
            approved_payments_count=approved_count,
            approved_tickets_count=approved_tickets_count,
            approved_amount_by_currency=dict(approved_amount_by_currency),
            missing_approved_amount_count=missing_approved_amount_count,
            pending_payments_count=pending_count,
            rejected_payments_count=rejected_count,
            draft_payments_count=draft_count,
        ),
        rows=rows,
        approvers=approver_summaries,
    )


def _payment_approval_report_to_csv(report: PaymentApprovalReportOut) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\r\n")
    w.writerow(
        [
            "codigo_estudiante",
            "nombre_estudiante",
            "payment_id",
            "tipo_pago",
            "estado",
            "boletas_aprobadas",
            "monto_cents",
            "moneda",
            "fecha_envio",
            "fecha_aprobacion",
            "aprobado_por",
            "email_aprobador",
            "responsable_recaudo",
        ]
    )
    for r in report.rows:
        w.writerow(
            [
                r.student_code_snapshot or "",
                r.display_name or "",
                str(r.payment_id),
                r.payment_type,
                r.status,
                r.ticket_quantity,
                r.amount_cents if r.amount_cents is not None else "",
                r.currency or "",
                r.submitted_at.isoformat() if r.submitted_at else "",
                r.approved_at.isoformat() if r.approved_at else "",
                r.approved_by_display_name or "",
                r.approved_by_email or "",
                r.responsible_collection or "",
            ]
        )
    w.writerow([])
    w.writerow(["TOTALES"])
    w.writerow(["pagos_aprobados", report.totals.approved_payments_count])
    w.writerow(["boletas_aprobadas", report.totals.approved_tickets_count])
    for currency, amount in sorted(report.totals.approved_amount_by_currency.items()):
        w.writerow([f"monto_aprobado_{currency}", amount])
    w.writerow(["aprobados_sin_monto", report.totals.missing_approved_amount_count])
    w.writerow(["pendientes", report.totals.pending_payments_count])
    w.writerow(["rechazados", report.totals.rejected_payments_count])
    w.writerow(["draft", report.totals.draft_payments_count])
    w.writerow([])
    w.writerow(["RESUMEN_POR_APROBADOR"])
    w.writerow(["aprobador", "email", "cantidad_aprobaciones", "monto_por_moneda"])
    for a in report.approvers:
        money = ", ".join(
            [f"{currency}:{amount}" for currency, amount in sorted(a.approved_amount_by_currency.items())]
        )
        w.writerow(
            [
                a.approver_display_name or "N/A",
                a.approver_email or "",
                a.approved_payments_count,
                money,
            ]
        )
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


@router.get("/{event_id}/staff/reports/venue-attendees", response_model=None)
def venue_attendees_report(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
    export_format: Annotated[Literal["json", "csv"], Query(alias="format")] = "json",
    include_non_active: Annotated[bool, Query()] = False,
) -> VenueReportOut | Response:
    ensure_super_admin(db, staff)
    ensure_event_staff_access(db, staff, event_id)
    report = _build_venue_report(db, event_id, include_non_active=include_non_active)
    if export_format == "csv":
        body = _venue_report_to_csv(report)
        return Response(
            content=body,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="venue-attendees-{event_id}.csv"',
            },
        )
    return report


@router.get("/{event_id}/staff/reports/payment-approvals", response_model=None)
def payment_approvals_report(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
    export_format: Annotated[Literal["json", "csv"], Query(alias="format")] = "json",
) -> PaymentApprovalReportOut | Response:
    ensure_super_admin(db, staff)
    ensure_event_staff_access(db, staff, event_id)
    report = _build_payment_approval_report(db, event_id)
    if export_format == "csv":
        body = _payment_approval_report_to_csv(report)
        return Response(
            content=body,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="payment-approvals-{event_id}.csv"',
            },
        )
    return report


@router.get("/{event_id}/staff/groups/search", response_model=list[StaffGroupSearchRowOut])
def search_groups(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
    student_code: str | None = Query(None, max_length=128),
    name: str | None = Query(None, max_length=400),
    document_id: str | None = Query(None, max_length=64),
    payment_status: str | None = Query(None, max_length=32),
    reservation_status: str | None = Query(None, max_length=32),
    layout_table_id: UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
) -> list[StaffGroupSearchRowOut]:
    _require_view_students(db, staff, event_id)
    stmt = select(AttendeeGroup).where(AttendeeGroup.event_id == event_id)
    if student_code:
        pat = f"%{student_code.strip()}%"
        stmt = stmt.where(AttendeeGroup.student_code_snapshot.ilike(pat))
    if name:
        n = f"%{name.strip()}%"
        stmt = stmt.where(
            or_(
                AttendeeGroup.display_name.ilike(n),
                exists(
                    select(1).where(
                        StudentRecord.id == AttendeeGroup.student_record_id,
                        or_(
                            StudentRecord.first_name.ilike(n),
                            StudentRecord.last_name.ilike(n),
                            func.concat(StudentRecord.first_name, " ", StudentRecord.last_name).ilike(n),
                        ),
                    )
                ),
            )
        )
    if document_id:
        doc = f"%{document_id.strip()}%"
        stmt = stmt.where(
            exists(
                select(1).where(
                    Participant.attendee_group_id == AttendeeGroup.id,
                    Participant.document_id.ilike(doc),
                )
            )
        )
    if payment_status:
        stmt = stmt.where(
            exists(
                select(1).where(
                    Payment.attendee_group_id == AttendeeGroup.id,
                    Payment.event_id == event_id,
                    Payment.status == payment_status.strip().upper(),
                )
            )
        )
    if reservation_status:
        stmt = stmt.where(AttendeeGroup.reservation_status == reservation_status.strip().upper())
    if layout_table_id:
        stmt = stmt.where(
            exists(
                select(1)
                .select_from(TableReservation)
                .join(Reservation, Reservation.id == TableReservation.reservation_id)
                .where(
                    Reservation.attendee_group_id == AttendeeGroup.id,
                    Reservation.event_id == event_id,
                    Reservation.status == "CONFIRMED",
                    TableReservation.layout_table_id == layout_table_id,
                    TableReservation.status == "ACTIVE",
                )
            )
        )
    stmt = stmt.order_by(AttendeeGroup.student_code_snapshot.asc()).limit(limit)
    groups = list(db.execute(stmt).scalars().unique().all())
    out: list[StaffGroupSearchRowOut] = []
    for g in groups:
        approved_sum = sum_approved_tickets_for_group(db, g.id, event_id)
        active_reserved = sum_confirmed_reservation_spots(db, g.id, event_id)
        available_balance = max(0, approved_sum - active_reserved)
        cur_pay = db.get(Payment, g.current_payment_id) if g.current_payment_id else None
        out.append(
            StaffGroupSearchRowOut(
                group_id=g.id,
                event_id=g.event_id,
                student_code_snapshot=g.student_code_snapshot,
                display_name=g.display_name,
                reservation_status=g.reservation_status,
                approved_ticket_count=approved_sum,
                active_spots_reserved=active_reserved,
                available_reservation_balance=available_balance,
                current_payment_status=cur_pay.status if cur_pay else None,
            )
        )
    return out


@router.get("/{event_id}/staff/groups/{group_id}", response_model=StaffGroupDetailOut)
def get_group_detail(
    event_id: UUID,
    group_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> StaffGroupDetailOut:
    _require_view_students(db, staff, event_id)
    g = _load_group_in_event(db, event_id, group_id)
    summary = _my_group_out(db, event_id, g)
    participants = list(
        db.execute(
            select(Participant).where(Participant.attendee_group_id == group_id).order_by(Participant.id)
        ).scalars()
    )
    pays = list(
        db.execute(
            select(Payment)
            .where(Payment.attendee_group_id == group_id, Payment.event_id == event_id)
            .order_by(Payment.created_at.desc())
            .limit(20)
        ).scalars()
    )
    res_rows = list(
        db.execute(
            select(Reservation)
            .where(Reservation.attendee_group_id == group_id, Reservation.event_id == event_id)
            .order_by(Reservation.created_at.desc())
        ).scalars()
    )
    all_table_ids: set[UUID] = set()
    for res in res_rows:
        for tr in db.execute(
            select(TableReservation).where(TableReservation.reservation_id == res.id)
        ).scalars():
            all_table_ids.add(tr.layout_table_id)
    code_by_table = _table_code_map(db, all_table_ids)
    reservations_out: list[ReservationStaffDetailOut] = []
    for res in res_rows:
        trs = list(
            db.execute(
                select(TableReservation)
                .where(TableReservation.reservation_id == res.id)
                .order_by(TableReservation.id)
            ).scalars()
        )
        reservations_out.append(
            ReservationStaffDetailOut(
                reservation_id=res.id,
                status=res.status,
                total_spots_reserved=res.total_spots_reserved,
                payment_id=res.payment_id,
                created_at=res.created_at,
                lines=[
                    TableReservationLineOut(
                        id=tr.id,
                        layout_table_id=tr.layout_table_id,
                        table_code=code_by_table.get(tr.layout_table_id),
                        spots_reserved=tr.spots_reserved,
                        status=tr.status,
                    )
                    for tr in trs
                ],
            )
        )
    raw_codes = participant_reservation_codes(db, group_id)
    codes_out = [
        ReservationCodeStaffOut(
            participant_id=UUID(str(r["participant_id"])),
            reservation_id=UUID(str(r["reservation_id"])),
            reservation_code=str(r["reservation_code"]),
            code_sequence_number=int(r["code_sequence_number"]),
        )
        for r in raw_codes
    ]
    return StaffGroupDetailOut(
        summary=summary,
        participants=[ParticipantStaffOut.model_validate(p) for p in participants],
        payments=[PaymentSummaryOut.model_validate(p) for p in pays],
        reservations=reservations_out,
        reservation_codes=codes_out,
    )


@router.get("/{event_id}/staff/groups/{group_id}/audit-log", response_model=list[AuditLogStaffOut])
def list_group_audit(
    event_id: UUID,
    group_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
    limit: int = Query(200, ge=1, le=500),
) -> list[AuditLog]:
    _require_view_students(db, staff, event_id)
    _ = _load_group_in_event(db, event_id, group_id)
    res_ids = select(Reservation.id).where(
        Reservation.attendee_group_id == group_id,
        Reservation.event_id == event_id,
    )
    part_ids = select(Participant.id).where(Participant.attendee_group_id == group_id)
    rid_match = AuditLog.payload_json["reservation_id"].astext.in_(
        select(sql_cast(Reservation.id, String)).where(
            Reservation.attendee_group_id == group_id,
            Reservation.event_id == event_id,
        )
    )
    conditions = or_(
        AuditLog.entity_id == group_id,
        AuditLog.entity_id.in_(res_ids),
        AuditLog.entity_id.in_(part_ids),
        AuditLog.payload_json.contains({"attendeeGroupId": str(group_id)}),
        rid_match,
    )
    return list(
        db.execute(
            select(AuditLog)
            .where(AuditLog.event_id == event_id, conditions)
            .order_by(AuditLog.occurred_at.desc())
            .limit(limit)
        ).scalars()
    )


@router.patch("/{event_id}/staff/participants/{participant_id}", response_model=ParticipantStaffOut)
def staff_patch_participant(
    event_id: UUID,
    participant_id: UUID,
    body: StaffParticipantPatchBody,
    db: DbSession,
    staff: StaffUserDep,
) -> Participant:
    ev = _require_manage_students(db, staff, event_id)
    p = db.get(Participant, participant_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    g = _load_group_in_event(db, event_id, p.attendee_group_id)
    if g.id != p.attendee_group_id:
        raise HTTPException(status_code=404, detail="Participant not found")
    before: dict[str, Any] = {
        "first_name": p.first_name,
        "last_name": p.last_name,
        "document_type": p.document_type,
        "document_id": p.document_id,
        "is_vegetarian": p.is_vegetarian,
        "allergies": p.allergies,
        "mobile_phone": p.mobile_phone,
        "emergency_contact_name": p.emergency_contact_name,
        "emergency_contact_phone": p.emergency_contact_phone,
        "has_reduced_mobility": p.has_reduced_mobility,
    }
    data = body.fields.model_dump(exclude_unset=True)
    if not data:
        raise ValidationError("At least one field is required", code=INVALID_PAYLOAD)
    for k, v in data.items():
        setattr(p, k, v)
    after = {k: getattr(p, k) for k in before}
    changes = {k: {"old": before[k], "new": after[k]} for k in before if before[k] != after[k]}
    append_audit_log(
        db,
        tenant_id=ev.tenant_id,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="participant",
        entity_id=p.id,
        action="STAFF_UPDATE_PARTICIPANT",
        payload_json={
            "reason": body.reason,
            "attendeeGroupId": str(g.id),
            "changes": changes,
        },
    )
    db.flush()
    return p


@router.post("/{event_id}/staff/groups/{group_id}/participants", response_model=ParticipantStaffOut)
def staff_create_participant(
    event_id: UUID,
    group_id: UUID,
    body: StaffParticipantCreateBody,
    db: DbSession,
    staff: StaffUserDep,
) -> Participant:
    ensure_super_admin(db, staff)
    ev = ensure_event_staff_access(db, staff, event_id)
    g = _load_group_in_event(db, event_id, group_id)
    approved = sum_approved_tickets_for_group(db, group_id, event_id)
    if approved < 1:
        raise ValidationError(
            "Cannot add participant without at least one approved payment for this group.",
            code=INVALID_PAYLOAD,
        )
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    cap = current_max_participants_per_group(cfg) if cfg is not None else 4
    existing = int(
        db.execute(
            select(func.count()).select_from(Participant).where(Participant.attendee_group_id == group_id)
        ).scalar_one()
    )
    if existing >= approved:
        raise ValidationError(
            "Adding another participant would exceed approved tickets for this group.",
            code=RESERVATION_EXCEEDS_APPROVED_TICKETS,
        )
    if existing >= cap:
        raise ValidationError(
            f"Cannot exceed the current commercial-stage participant limit ({cap}).",
            code=PARTICIPANT_LIMIT_EXCEEDED,
        )
    pdata = body.participant.model_dump()
    p = Participant(attendee_group_id=group_id, **pdata)
    db.add(p)
    db.flush()
    append_audit_log(
        db,
        tenant_id=ev.tenant_id,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="participant",
        entity_id=p.id,
        action="STAFF_CREATE_PARTICIPANT",
        payload_json={
            "reason": body.reason,
            "attendeeGroupId": str(group_id),
            "participant": pdata,
        },
    )
    db.flush()
    return p


@router.post("/{event_id}/staff/reservations/{reservation_id}/release")
def staff_release_reservation(
    event_id: UUID,
    reservation_id: UUID,
    body: StaffReasonBody,
    db: DbSession,
    staff: StaffUserDep,
) -> dict[str, bool]:
    ensure_super_admin(db, staff)
    ev = ensure_event_staff_access(db, staff, event_id)
    res = db.get(Reservation, reservation_id)
    if res is None or res.event_id != event_id:
        raise HTTPException(status_code=404, detail="Reservation not found")
    try:
        release_reservation(db, reservation_id, res.attendee_group_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=e.message) from e
    append_audit_log(
        db,
        tenant_id=ev.tenant_id,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="reservation",
        entity_id=reservation_id,
        action="STAFF_RELEASE_RESERVATION",
        payload_json={
            "reason": body.reason,
            "attendeeGroupId": str(res.attendee_group_id),
        },
    )
    db.flush()
    return {"ok": True}


@router.post("/{event_id}/staff/reservations/{reservation_id}/move")
def staff_move_reservation(
    event_id: UUID,
    reservation_id: UUID,
    body: StaffReservationMoveBody,
    db: DbSession,
    staff: StaffUserDep,
    detailed: bool = False,
) -> dict[str, Any]:
    ensure_super_admin(db, staff)
    ev = ensure_event_staff_access(db, staff, event_id)
    res = db.get(Reservation, reservation_id)
    if res is None or res.event_id != event_id:
        raise HTTPException(status_code=404, detail="Reservation not found")
    try:
        res2 = move_reservation(
            db,
            reservation_id=reservation_id,
            group_id=res.attendee_group_id,
            event_id=event_id,
            allocations=[TableAllocation(a.layout_table_id, a.spots) for a in body.allocations],
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=e.message) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.message) from e
    append_audit_log(
        db,
        tenant_id=ev.tenant_id,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="reservation",
        entity_id=reservation_id,
        action="STAFF_MOVE_RESERVATION",
        payload_json={
            "reason": body.reason,
            "attendeeGroupId": str(res.attendee_group_id),
            "allocations": [a.model_dump(by_alias=True) for a in body.allocations],
        },
    )
    db.flush()
    res_out = _build_reservation_out(db, res2, detailed_legal=detailed)
    return _serialize_reservation(res_out)


# Import MoveBody only for type reference if needed — StaffReservationMoveBody replaces it
