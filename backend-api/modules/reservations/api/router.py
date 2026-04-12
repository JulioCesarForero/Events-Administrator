from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.api.schemas import CamelModel, CamelOrmModel

from infrastructure.persistence.models import Reservation, ReservationCodeAssignment, ReservationConsent, TableReservation
from modules.reservations.application.reservation_service import (
    TableAllocation,
    create_reservation,
    move_reservation,
    release_reservation,
)
from shared.api.deps import BuyerClaimsDep, DbSession, buyer_event_id, buyer_group_id

router = APIRouter(tags=["reservations"])


class AllocationIn(CamelModel):
    layout_table_id: UUID
    spots: int = Field(ge=1)


class ReservationCreateIn(CamelModel):
    payment_id: UUID
    allocations: list[AllocationIn]
    policy_document_id: UUID
    terms_document_id: UUID


class ReservationCodeOut(CamelModel):
    participant_id: UUID
    reservation_code: str
    code_sequence_number: int


class AllocationOut(CamelModel):
    layout_table_id: UUID
    spots_reserved: int


class LegalAcceptanceOut(CamelModel):
    policy_document_id: UUID
    terms_document_id: UUID
    policy_version_label: str
    terms_version_label: str
    accepted_at: datetime


class ReservationOut(CamelOrmModel):
    id: UUID
    event_id: UUID
    attendee_group_id: UUID
    payment_id: UUID
    status: str
    total_spots_reserved: int
    code_sequence_start: int | None
    code_sequence_end: int | None
    reservation_codes: list[ReservationCodeOut] = []
    allocations: list[AllocationOut] = []
    legal_acceptance: LegalAcceptanceOut | None = None


class MoveBody(CamelModel):
    allocations: list[AllocationIn]


def _build_reservation_out(db: Session, res: Reservation) -> ReservationOut:
    codes = list(
        db.execute(
            select(ReservationCodeAssignment)
            .where(ReservationCodeAssignment.reservation_id == res.id)
            .order_by(ReservationCodeAssignment.code_sequence_number)
        ).scalars()
    )
    allocs = list(
        db.execute(
            select(TableReservation).where(
                TableReservation.reservation_id == res.id,
                TableReservation.status == "ACTIVE",
            )
        ).scalars()
    )
    consent = db.execute(
        select(ReservationConsent).where(ReservationConsent.reservation_id == res.id)
    ).scalar_one_or_none()
    return ReservationOut(
        id=res.id,
        event_id=res.event_id,
        attendee_group_id=res.attendee_group_id,
        payment_id=res.payment_id,
        status=res.status,
        total_spots_reserved=res.total_spots_reserved,
        code_sequence_start=res.code_sequence_start,
        code_sequence_end=res.code_sequence_end,
        reservation_codes=[
            ReservationCodeOut(
                participant_id=c.participant_id,
                reservation_code=c.reservation_code,
                code_sequence_number=c.code_sequence_number,
            )
            for c in codes
        ],
        allocations=[
            AllocationOut(layout_table_id=a.layout_table_id, spots_reserved=a.spots_reserved)
            for a in allocs
        ],
        legal_acceptance=LegalAcceptanceOut(
            policy_document_id=consent.policy_document_id,
            terms_document_id=consent.terms_document_id,
            policy_version_label=consent.policy_version_label,
            terms_version_label=consent.terms_version_label,
            accepted_at=consent.accepted_at,
        ) if consent else None,
    )


@router.post("/events/{event_id}/reservations", response_model=ReservationOut)
def post_reservation(
    event_id: UUID,
    body: ReservationCreateIn,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> ReservationOut:
    gid = buyer_group_id(claims)
    if buyer_event_id(claims) != event_id:
        raise HTTPException(status_code=403, detail="Token not valid for this event")
    res = create_reservation(
        db,
        event_id=event_id,
        group_id=gid,
        payment_id=body.payment_id,
        allocations=[TableAllocation(a.layout_table_id, a.spots) for a in body.allocations],
        policy_document_id=body.policy_document_id,
        terms_document_id=body.terms_document_id,
    )
    return _build_reservation_out(db, res)


@router.post("/reservations/{reservation_id}/release")
def post_release(
    reservation_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> dict:
    release_reservation(db, reservation_id, buyer_group_id(claims))
    return {"ok": True}


@router.post("/reservations/{reservation_id}/move", response_model=ReservationOut)
def post_move(
    reservation_id: UUID,
    body: MoveBody,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> ReservationOut:
    eid = buyer_event_id(claims)
    res = move_reservation(
        db,
        reservation_id=reservation_id,
        group_id=buyer_group_id(claims),
        event_id=eid,
        allocations=[TableAllocation(a.layout_table_id, a.spots) for a in body.allocations],
    )
    return _build_reservation_out(db, res)
