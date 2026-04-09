from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from domain.exceptions import DomainError
from infrastructure.persistence.models import Reservation
from modules.reservations.application.reservation_service import (
    TableAllocation,
    create_reservation,
    move_reservation,
    release_reservation,
)
from shared.api.deps import BuyerClaimsDep, DbSession, buyer_event_id, buyer_group_id
from shared.exceptions.http_map import domain_error_to_http

router = APIRouter(tags=["reservations"])


class AllocationIn(BaseModel):
    layout_table_id: UUID
    spots: int = Field(ge=1)


class ReservationCreateIn(BaseModel):
    payment_id: UUID
    allocations: list[AllocationIn]
    policy_document_id: UUID
    terms_document_id: UUID


class ReservationOut(BaseModel):
    id: UUID
    event_id: UUID
    attendee_group_id: UUID
    payment_id: UUID
    status: str
    total_spots_reserved: int
    code_sequence_start: int | None
    code_sequence_end: int | None

    model_config = {"from_attributes": True}


@router.post("/events/{event_id}/reservations", response_model=ReservationOut)
def post_reservation(
    event_id: UUID,
    body: ReservationCreateIn,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Reservation:
    gid = buyer_group_id(claims)
    if buyer_event_id(claims) != event_id:
        raise HTTPException(status_code=403, detail="Token not valid for this event")
    try:
        res = create_reservation(
            db,
            event_id=event_id,
            group_id=gid,
            payment_id=body.payment_id,
            allocations=[TableAllocation(a.layout_table_id, a.spots) for a in body.allocations],
            policy_document_id=body.policy_document_id,
            terms_document_id=body.terms_document_id,
        )
    except DomainError as e:
        raise domain_error_to_http(e) from e
    return res


@router.post("/reservations/{reservation_id}/release")
def post_release(
    reservation_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> dict:
    try:
        release_reservation(db, reservation_id, buyer_group_id(claims))
    except DomainError as e:
        raise domain_error_to_http(e) from e
    return {"ok": True}


class MoveBody(BaseModel):
    allocations: list[AllocationIn]


@router.post("/reservations/{reservation_id}/move", response_model=ReservationOut)
def post_move(
    reservation_id: UUID,
    body: MoveBody,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Reservation:
    eid = buyer_event_id(claims)
    try:
        return move_reservation(
            db,
            reservation_id=reservation_id,
            group_id=buyer_group_id(claims),
            event_id=eid,
            allocations=[TableAllocation(a.layout_table_id, a.spots) for a in body.allocations],
        )
    except DomainError as e:
        raise domain_error_to_http(e) from e
