from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field

from shared.api.schemas import CamelModel, CamelOrmModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from infrastructure.persistence.models import (
    AttendeeGroup,
    Event,
    EventConfiguration,
    Participant,
    Payment,
    Reservation,
    StaffUser,
    TableReservation,
)
from modules.attendees.domain.rules import ensure_participant_editable_window
from domain.error_codes import PARTICIPANT_LIMIT_EXCEEDED
from domain.exceptions import ValidationError
from modules.payments.application.stage_capacity import (
    current_max_participants_per_group,
    latest_approved_payment_id,
    sum_approved_tickets_for_group,
    sum_confirmed_reservation_spots,
)
from shared.api.deps import (
    BuyerClaimsDep,
    DbSession,
    StaffUserDep,
    buyer_event_id,
    buyer_group_id,
    ensure_event_staff_access,
)

router = APIRouter(tags=["attendees"])


def _get_group_for_buyer(db: Session, claims: dict, event_id: UUID) -> AttendeeGroup:
    gid = buyer_group_id(claims)
    ev = buyer_event_id(claims)
    if ev != event_id:
        raise HTTPException(status_code=403, detail="Token not valid for this event")
    g = db.get(AttendeeGroup, gid)
    if g is None or g.event_id != event_id:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


def _effective_group_payment(db: Session, group: AttendeeGroup) -> Payment | None:
    """
    Resolve the payment that should drive buyer-facing state.
    Prefer the current payment when approved; otherwise fallback to latest approved.
    """
    pay: Payment | None = (
        db.get(Payment, group.current_payment_id) if group.current_payment_id else None
    )
    if pay is not None and pay.status == "APPROVED":
        return pay
    return (
        db.execute(
            select(Payment)
            .where(
                Payment.attendee_group_id == group.id,
                Payment.event_id == group.event_id,
                Payment.status == "APPROVED",
            )
            .order_by(Payment.approved_at.desc())
            .limit(1)
        ).scalar_one_or_none()
    )


class MyGroupPaymentOut(CamelOrmModel):
    id: UUID
    status: str
    ticket_quantity: int
    payment_type: str
    rejection_reason: str | None = None
    submitted_at: datetime | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None


class MyGroupOut(CamelOrmModel):
    group_id: UUID = Field(validation_alias="id")
    event_id: UUID
    student_code_snapshot: str
    display_name: str | None
    reservation_status: str
    approved_ticket_count: int
    active_spots_reserved: int = Field(
        default=0,
        description="RN-RES-08: sum of total_spots_reserved on CONFIRMED reservations for this event.",
    )
    available_reservation_balance: int = Field(
        default=0,
        description="RN-RES-08: approved_ticket_count minus active_spots_reserved (floored at 0).",
    )
    current_payment_id: UUID | None = None
    latest_approved_payment_id: UUID | None = None
    current_payment: MyGroupPaymentOut | None = None
    event_date: datetime | None = None
    timezone: str | None = None
    ticket_price: int = 50000
    payment_instructions: str | None = None
    max_participants_allowed: int = 4


@router.get("/portal/events/{event_id}/my-group", response_model=MyGroupOut)
def get_my_group(
    event_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> MyGroupOut:
    g = _get_group_for_buyer(db, claims, event_id)
    ev = db.get(Event, event_id)
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    wf: Payment | None = (
        db.get(Payment, g.current_payment_id) if g.current_payment_id else None
    )
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


class MyReservationAllocationOut(CamelModel):
    layout_table_id: UUID
    spots_reserved: int


class MyReservationOut(CamelModel):
    reservation_id: UUID
    total_spots_reserved: int
    status: str
    created_at: datetime | None = None
    allocations: list[MyReservationAllocationOut]


@router.get("/portal/events/{event_id}/my-reservations", response_model=list[MyReservationOut])
def get_my_reservations(
    event_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> list[MyReservationOut]:
    """List CONFIRMED reservations for the buyer group (portal read-only summary)."""
    g = _get_group_for_buyer(db, claims, event_id)
    reservations = list(
        db.execute(
            select(Reservation)
            .where(
                Reservation.attendee_group_id == g.id,
                Reservation.event_id == event_id,
                Reservation.status == "CONFIRMED",
            )
            .order_by(Reservation.created_at.asc())
        ).scalars().all()
    )
    out: list[MyReservationOut] = []
    for res in reservations:
        trs = list(
            db.execute(
                select(TableReservation).where(
                    TableReservation.reservation_id == res.id,
                    TableReservation.status == "ACTIVE",
                )
            ).scalars().all()
        )
        out.append(
            MyReservationOut(
                reservation_id=res.id,
                total_spots_reserved=res.total_spots_reserved,
                status=res.status,
                created_at=res.created_at,
                allocations=[
                    MyReservationAllocationOut(
                        layout_table_id=tr.layout_table_id,
                        spots_reserved=tr.spots_reserved,
                    )
                    for tr in trs
                ],
            )
        )
    return out


class ParticipantCreate(CamelModel):
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


class ParticipantOut(CamelOrmModel):
    id: UUID
    attendee_group_id: UUID
    first_name: str
    last_name: str


class ParticipantUpdate(CamelModel):
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


def _load_event_for_group(db: Session, group: AttendeeGroup) -> Event:
    ev = db.get(Event, group.event_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return ev


def _event_timezone(db: Session, event_id: UUID) -> str | None:
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    return cfg.timezone if cfg else None


def _can_access_group(
    db: Session,
    staff: StaffUser | None,
    claims: dict | None,
    group_id: UUID,
) -> AttendeeGroup:
    g = db.get(AttendeeGroup, group_id)
    if g is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if staff is not None:
        ensure_event_staff_access(db, staff, g.event_id)
        return g
    if claims is not None:
        if buyer_group_id(claims) != group_id:
            raise HTTPException(status_code=403, detail="Not your group")
        return g
    raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/groups/{group_id}/participants", response_model=list[ParticipantOut])
def list_participants(
    group_id: UUID,
    db: DbSession,
    request: Request,
) -> list[Participant]:
    staff = getattr(request.state, "staff_user", None)
    claims = getattr(request.state, "buyer_claims", None)
    if staff is None and claims is None:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            from config.settings import settings
            from infrastructure.security.jwt_tokens import decode_token
            import jwt as _jwt
            try:
                payload = decode_token(token, settings.jwt_staff_audience)
                uid = payload.get("sub")
                if uid:
                    staff = db.get(StaffUser, UUID(uid))
            except _jwt.PyJWTError:
                pass
            if staff is None:
                try:
                    payload = decode_token(token, settings.jwt_buyer_audience)
                    if payload.get("typ") == "buyer":
                        claims = payload
                except _jwt.PyJWTError:
                    pass
    if staff is None and claims is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    _can_access_group(db, staff, claims, group_id)
    return list(
        db.execute(
            select(Participant).where(Participant.attendee_group_id == group_id)
        ).scalars()
    )


@router.post("/groups/{group_id}/participants", response_model=ParticipantOut)
def create_participant(
    group_id: UUID,
    body: ParticipantCreate,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Participant:
    g = _can_access_group(db, None, claims, group_id)
    ev = _load_event_for_group(db, g)
    tz = _event_timezone(db, ev.id)
    ensure_participant_editable_window(ev.event_date, timezone=tz)
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == g.event_id)
    ).scalar_one_or_none()
    if cfg is not None:
        cap = current_max_participants_per_group(cfg)
        existing = db.execute(
            select(func.count())
            .select_from(Participant)
            .where(Participant.attendee_group_id == group_id)
        ).scalar_one()
        if int(existing) >= cap:
            raise ValidationError(
                f"No puedes registrar más de {cap} asistentes: has alcanzado el cupo máximo "
                "permitido para esta etapa del evento.",
                code=PARTICIPANT_LIMIT_EXCEEDED,
            )
    p = Participant(attendee_group_id=group_id, **body.model_dump())
    db.add(p)
    db.flush()
    return p


@router.patch("/participants/{participant_id}", response_model=ParticipantOut)
def update_participant(
    participant_id: UUID,
    body: ParticipantUpdate,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Participant:
    p = db.get(Participant, participant_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    _can_access_group(db, None, claims, p.attendee_group_id)
    g = db.get(AttendeeGroup, p.attendee_group_id)
    assert g is not None
    ev = _load_event_for_group(db, g)
    tz = _event_timezone(db, ev.id)
    ensure_participant_editable_window(ev.event_date, timezone=tz)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    db.flush()
    return p


@router.delete("/groups/{group_id}/participants/{participant_id}", status_code=204)
def delete_participant(
    group_id: UUID,
    participant_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> None:
    g = _can_access_group(db, None, claims, group_id)
    ev = _load_event_for_group(db, g)
    tz = _event_timezone(db, ev.id)
    ensure_participant_editable_window(ev.event_date, timezone=tz)

    p = db.get(Participant, participant_id)
    if p is None or p.attendee_group_id != group_id:
        raise HTTPException(status_code=404, detail="Participant not found")

    db.delete(p)
    db.flush()
