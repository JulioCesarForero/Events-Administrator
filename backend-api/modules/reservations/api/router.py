from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import AliasChoices, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from domain.error_codes import LEGAL_ACCEPTANCE_REQUIRED
from domain.exceptions import ValidationError as DomainValidationError
from infrastructure.persistence.models import (
    Reservation,
    ReservationCodeAssignment,
    ReservationConsent,
    TableReservation,
)
from modules.reservations.application.reservation_service import (
    TableAllocation,
    create_reservation,
    move_reservation,
    release_reservation,
)
from shared.api.deps import BuyerClaimsDep, DbSession, buyer_event_id, buyer_group_id
from shared.api.schemas import CamelModel, CamelOrmModel

router = APIRouter(tags=["reservations"])


class AllocationIn(CamelModel):
    layout_table_id: UUID
    spots: int = Field(
        ge=1,
        validation_alias=AliasChoices("spots", "spotsReserved", "spots_reserved"),
        serialization_alias="spotsReserved",
    )


class LegalAcceptanceIn(CamelModel):
    accepted: bool = True
    policy_document_id: UUID
    terms_document_id: UUID


class ReservationCreateIn(CamelModel):
    """Create reservation payload. Accepts both the contract §4.8 nested shape
    and the legacy flat shape (`policyDocumentId/termsDocumentId` at root)."""

    group_id: UUID | None = None
    payment_id: UUID
    allocations: list[AllocationIn]
    legal_acceptance: LegalAcceptanceIn | None = None
    # Legacy flat fields kept for backward compatibility.
    policy_document_id: UUID | None = None
    terms_document_id: UUID | None = None

    @model_validator(mode="after")
    def _coalesce_legal_acceptance(self) -> "ReservationCreateIn":
        if self.legal_acceptance is None:
            if self.policy_document_id is None or self.terms_document_id is None:
                raise DomainValidationError(
                    "Legal acceptance is required: provide legalAcceptance "
                    "or both policyDocumentId and termsDocumentId",
                    code=LEGAL_ACCEPTANCE_REQUIRED,
                )
            self.legal_acceptance = LegalAcceptanceIn(
                accepted=True,
                policy_document_id=self.policy_document_id,
                terms_document_id=self.terms_document_id,
            )
        if not self.legal_acceptance.accepted:
            raise DomainValidationError(
                "Debes aceptar la política de datos y los términos y condiciones para crear la reserva.",
                code=LEGAL_ACCEPTANCE_REQUIRED,
            )
        return self


class ReservationCodeOut(CamelModel):
    participant_id: UUID
    code: str = Field(
        serialization_alias="code",
        validation_alias=AliasChoices("code", "reservationCode", "reservation_code"),
    )
    code_sequence_number: int
    # Legacy name, emitted via model_dump post-processing below.
    reservation_code: str | None = None


class AllocationOut(CamelModel):
    layout_table_id: UUID
    spots_reserved: int


class LegalAcceptanceOut(CamelModel):
    policy_version_label: str
    terms_version_label: str
    accepted_at: datetime


class LegalAcceptanceDetailedOut(LegalAcceptanceOut):
    policy_document_id: UUID
    terms_document_id: UUID


class ReservationOut(CamelOrmModel):
    """Contract §4.8 canonical shape. `reservationId` is canonical; `id` kept as
    legacy alias so older clients keep reading the same value."""

    reservation_id: UUID = Field(
        serialization_alias="reservationId",
        validation_alias=AliasChoices("id", "reservation_id", "reservationId"),
    )
    event_id: UUID
    attendee_group_id: UUID
    payment_id: UUID
    status: str
    total_spots_reserved: int
    code_sequence_start: int | None = None
    code_sequence_end: int | None = None
    reservation_codes: list[ReservationCodeOut] = []
    allocations: list[AllocationOut] = []
    legal_acceptance: LegalAcceptanceOut | LegalAcceptanceDetailedOut | None = None


class MoveBody(CamelModel):
    allocations: list[AllocationIn]


def _serialize_reservation(res_out: ReservationOut) -> dict:
    """Emit both the canonical `reservationId` and the legacy `id` key so
    existing clients continue to parse the old shape."""
    data = res_out.model_dump(mode="json", by_alias=True, exclude_none=True)
    if "reservationId" in data:
        data["id"] = data["reservationId"]
    # Emit legacy `reservationCode` alongside the canonical `code` for codes.
    for c in data.get("reservationCodes", []) or []:
        if isinstance(c, dict) and "code" in c:
            c.setdefault("reservationCode", c["code"])
    return data


def _build_reservation_out(
    db: Session, res: Reservation, *, detailed_legal: bool = False
) -> ReservationOut:
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

    if consent is None:
        legal_out: LegalAcceptanceOut | LegalAcceptanceDetailedOut | None = None
    else:
        # server_default timestamps are not always populated on the ORM instance until refresh.
        accepted_at = consent.accepted_at or datetime.now(UTC)
        if detailed_legal:
            legal_out = LegalAcceptanceDetailedOut(
                policy_document_id=consent.policy_document_id,
                terms_document_id=consent.terms_document_id,
                policy_version_label=consent.policy_version_label,
                terms_version_label=consent.terms_version_label,
                accepted_at=accepted_at,
            )
        else:
            legal_out = LegalAcceptanceOut(
                policy_version_label=consent.policy_version_label,
                terms_version_label=consent.terms_version_label,
                accepted_at=accepted_at,
            )

    return ReservationOut(
        reservation_id=res.id,
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
                code=c.reservation_code,
                code_sequence_number=c.code_sequence_number,
                reservation_code=c.reservation_code,
            )
            for c in codes
        ],
        allocations=[
            AllocationOut(layout_table_id=a.layout_table_id, spots_reserved=a.spots_reserved)
            for a in allocs
        ],
        legal_acceptance=legal_out,
    )


@router.post("/events/{event_id}/reservations")
def post_reservation(
    event_id: UUID,
    body: ReservationCreateIn,
    db: DbSession,
    claims: BuyerClaimsDep,
    detailed: bool = False,
):
    gid = buyer_group_id(claims)
    if buyer_event_id(claims) != event_id:
        raise HTTPException(status_code=403, detail="Token not valid for this event")
    if body.group_id is not None and body.group_id != gid:
        raise HTTPException(status_code=403, detail="groupId does not match session")

    assert body.legal_acceptance is not None  # guaranteed by validator
    res = create_reservation(
        db,
        event_id=event_id,
        group_id=gid,
        payment_id=body.payment_id,
        allocations=[TableAllocation(a.layout_table_id, a.spots) for a in body.allocations],
        policy_document_id=body.legal_acceptance.policy_document_id,
        terms_document_id=body.legal_acceptance.terms_document_id,
    )
    res_out = _build_reservation_out(db, res, detailed_legal=detailed)
    return _serialize_reservation(res_out)


@router.post("/reservations/{reservation_id}/release")
def post_release(
    reservation_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> dict:
    release_reservation(db, reservation_id, buyer_group_id(claims))
    return {"ok": True}


@router.post("/reservations/{reservation_id}/move")
def post_move(
    reservation_id: UUID,
    body: MoveBody,
    db: DbSession,
    claims: BuyerClaimsDep,
    detailed: bool = False,
):
    eid = buyer_event_id(claims)
    res = move_reservation(
        db,
        reservation_id=reservation_id,
        group_id=buyer_group_id(claims),
        event_id=eid,
        allocations=[TableAllocation(a.layout_table_id, a.spots) for a in body.allocations],
    )
    res_out = _build_reservation_out(db, res, detailed_legal=detailed)
    return _serialize_reservation(res_out)
