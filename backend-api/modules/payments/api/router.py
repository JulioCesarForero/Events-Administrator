from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import AliasChoices, Field, computed_field

from shared.api.schemas import CamelModel, CamelOrmModel
from sqlalchemy import select

from domain.error_codes import (
    MISSING_PAYMENT_EVIDENCE,
    PARTICIPANTS_INCOMPLETE,
    PAYMENT_ALREADY_REVIEWED,
    PAYMENT_INVALID_STATE,
    PAYMENT_NOT_APPROVED,
    STAGE_LIMIT_EXCEEDED,
)
from domain.exceptions import ConflictError, ValidationError
from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import (
    AttendeeGroup,
    Event,
    EventConfiguration,
    Participant,
    Payment,
    PaymentEvidence,
)
from shared.api.deps import BuyerClaimsDep, DbSession, StaffUserDep, buyer_group_id, ensure_event_staff_access

router = APIRouter(tags=["payments"])


def _buyer_group(db, claims, group_id: UUID) -> AttendeeGroup:
    if buyer_group_id(claims) != group_id:
        raise HTTPException(status_code=403, detail="Not your group")
    g = db.get(AttendeeGroup, group_id)
    if g is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


class PaymentCreate(CamelModel):
    payment_type: str = Field(max_length=16)
    ticket_quantity: int = Field(ge=1)
    amount_cents: int | None = None
    currency: str = Field(default="COP", max_length=3)


class PaymentOut(CamelOrmModel):
    id: UUID
    event_id: UUID
    attendee_group_id: UUID
    status: str
    ticket_quantity: int
    payment_type: str
    amount_cents: int | None = None
    currency: str | None = None
    submitted_at: datetime | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    # Contract §4.9 uses `reason`; legacy DB column is `rejection_reason`.
    rejection_reason: str | None = Field(
        default=None,
        validation_alias=AliasChoices("rejection_reason", "reason"),
        serialization_alias="rejectionReason",
    )

    @computed_field  # type: ignore[misc]
    @property
    def reason(self) -> str | None:
        """Canonical alias per contract §4.9."""
        return self.rejection_reason


def _check_stage_limit(db, event_id: UUID, requested_tickets: int) -> None:
    """Enforce RN-TIME-02/03: presale max 4, general max 3 tickets per group."""
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    if cfg is None:
        return
    now = datetime.now(UTC)
    if cfg.presale_start_date <= now <= cfg.presale_end_date:
        if requested_tickets > cfg.max_presale_tickets:
            raise ValidationError(
                f"Presale allows at most {cfg.max_presale_tickets} tickets",
                code=STAGE_LIMIT_EXCEEDED,
            )
    elif cfg.sale_start_date <= now <= cfg.sale_end_date:
        if requested_tickets > cfg.max_sale_tickets:
            raise ValidationError(
                f"General sale allows at most {cfg.max_sale_tickets} tickets",
                code=STAGE_LIMIT_EXCEEDED,
            )


@router.post("/groups/{group_id}/payments", response_model=PaymentOut)
def create_payment(
    group_id: UUID,
    body: PaymentCreate,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Payment:
    g = _buyer_group(db, claims, group_id)
    _check_stage_limit(db, g.event_id, body.ticket_quantity)
    pay = Payment(
        event_id=g.event_id,
        attendee_group_id=group_id,
        payment_type=body.payment_type,
        status="DRAFT",
        ticket_quantity=body.ticket_quantity,
        amount_cents=body.amount_cents,
        currency=body.currency,
    )
    db.add(pay)
    g.current_payment_id = pay.id
    db.flush()
    return pay


class PaymentPatch(CamelModel):
    ticket_quantity: int | None = Field(default=None, ge=1)
    amount_cents: int | None = None
    currency: str | None = Field(default=None, max_length=3)


@router.patch("/payments/{payment_id}", response_model=PaymentOut)
def patch_payment(
    payment_id: UUID,
    body: PaymentPatch,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Payment:
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    _buyer_group(db, claims, p.attendee_group_id)
    if p.status not in ("DRAFT", "REJECTED"):
        raise ConflictError("Payment cannot be edited in current status", code=PAYMENT_INVALID_STATE)

    patch_data = body.model_dump(exclude_unset=True)
    # Re-apply stage limits when the ticket quantity changes, matching
    # RN-TIME-02/03 so the buyer cannot bypass presale/sale caps via PATCH.
    new_qty = patch_data.get("ticket_quantity")
    if new_qty is not None and new_qty != p.ticket_quantity:
        _check_stage_limit(db, p.event_id, new_qty)

    if p.status == "REJECTED":
        p.status = "DRAFT"
        p.rejected_at = None
        p.rejection_reason = None
        p.reviewed_by_user_id = None
    for k, v in patch_data.items():
        setattr(p, k, v)
    db.flush()
    return p


@router.post("/payments/{payment_id}/submit", response_model=PaymentOut)
def submit_payment(
    payment_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Payment:
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    g = _buyer_group(db, claims, p.attendee_group_id)
    if p.status != "DRAFT":
        raise ConflictError("Invalid payment state", code=PAYMENT_INVALID_STATE)

    participant_count = db.execute(
        select(Participant).where(Participant.attendee_group_id == g.id)
    ).scalars().all()
    if len(participant_count) < p.ticket_quantity:
        raise ValidationError(
            f"All {p.ticket_quantity} participants must be registered before submitting payment",
            code=PARTICIPANTS_INCOMPLETE,
        )

    if p.payment_type == "DIGITAL":
        evidence = db.execute(
            select(PaymentEvidence).where(PaymentEvidence.payment_id == payment_id)
        ).scalars().first()
        if evidence is None:
            raise ValidationError(
                "Digital payment requires evidence before submission",
                code=MISSING_PAYMENT_EVIDENCE,
            )

    p.status = "PENDING_APPROVAL"
    p.submitted_at = datetime.now(UTC)
    db.flush()
    return p


@router.get("/events/{event_id}/payment-inbox", response_model=list[PaymentOut])
def payment_inbox(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[Payment]:
    ensure_event_staff_access(db, staff, event_id)
    return list(
        db.execute(
            select(Payment).where(
                Payment.event_id == event_id,
                Payment.status == "PENDING_APPROVAL",
            )
        ).scalars()
    )


class ApproveBody(CamelModel):
    approved_ticket_count: int | None = None


@router.post("/payments/{payment_id}/approve", response_model=PaymentOut)
def approve_payment(
    payment_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
    body: ApproveBody | None = None,
) -> Payment:
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    ensure_event_staff_access(db, staff, p.event_id)
    if p.status != "PENDING_APPROVAL":
        raise ConflictError("Payment is not pending approval", code=PAYMENT_ALREADY_REVIEWED)
    approved_count = (body.approved_ticket_count if body and body.approved_ticket_count else p.ticket_quantity)
    p.status = "APPROVED"
    p.ticket_quantity = approved_count
    p.approved_at = datetime.now(UTC)
    p.reviewed_by_user_id = staff.id
    g = db.get(AttendeeGroup, p.attendee_group_id)
    if g:
        g.approved_ticket_count = approved_count
    ev = db.get(Event, p.event_id)
    append_audit_log(
        db,
        tenant_id=ev.tenant_id if ev else None,
        event_id=p.event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="payment",
        entity_id=p.id,
        action="APPROVE",
    )
    db.flush()
    return p


class RejectBody(CamelModel):
    reason: str | None = None


@router.post("/payments/{payment_id}/reject", response_model=PaymentOut)
def reject_payment(
    payment_id: UUID,
    body: RejectBody,
    db: DbSession,
    staff: StaffUserDep,
) -> Payment:
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    ensure_event_staff_access(db, staff, p.event_id)
    if p.status != "PENDING_APPROVAL":
        raise ConflictError("Payment is not pending approval", code=PAYMENT_ALREADY_REVIEWED)
    p.status = "REJECTED"
    p.rejected_at = datetime.now(UTC)
    p.reviewed_by_user_id = staff.id
    p.rejection_reason = body.reason
    db.flush()
    return p


class CashPaymentCreate(CamelModel):
    attendee_group_id: UUID
    ticket_quantity: int = Field(ge=1)
    amount_cents: int | None = None
    currency: str = Field(default="COP", max_length=3)
    receipt_file_url: str = Field(min_length=1)


@router.post("/events/{event_id}/cash-payments", response_model=PaymentOut)
def create_cash_payment(
    event_id: UUID,
    body: CashPaymentCreate,
    db: DbSession,
    staff: StaffUserDep,
) -> Payment:
    ensure_event_staff_access(db, staff, event_id)
    g = db.get(AttendeeGroup, body.attendee_group_id)
    if g is None or g.event_id != event_id:
        raise HTTPException(status_code=400, detail="Invalid group for event")
    if not body.receipt_file_url:
        raise ValidationError(
            "Cash payment requires receipt evidence",
            code=MISSING_PAYMENT_EVIDENCE,
        )
    pay = Payment(
        event_id=event_id,
        attendee_group_id=body.attendee_group_id,
        payment_type="CASH",
        status="PENDING_APPROVAL",
        ticket_quantity=body.ticket_quantity,
        amount_cents=body.amount_cents,
        currency=body.currency,
        submitted_at=datetime.now(UTC),
    )
    db.add(pay)
    db.flush()
    db.add(
        PaymentEvidence(
            payment_id=pay.id,
            file_url=body.receipt_file_url,
            evidence_type="CASH_RECEIPT",
            uploaded_by_actor_type="STAFF",
        )
    )
    g.current_payment_id = pay.id
    ev = db.get(Event, event_id)
    append_audit_log(
        db,
        tenant_id=ev.tenant_id if ev else None,
        event_id=event_id,
        actor_user_id=staff.id,
        actor_type="STAFF",
        entity_type="payment",
        entity_id=pay.id,
        action="CASH_PAYMENT_CREATED",
    )
    db.flush()
    return pay


class EvidenceUrlResponse(CamelModel):
    upload_url: str


@router.post("/payments/{payment_id}/evidence-upload-url", response_model=EvidenceUrlResponse)
def evidence_upload_url(
    payment_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> EvidenceUrlResponse:
    from infrastructure.storage.signed_urls import generate_upload_url

    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    _buyer_group(db, claims, p.attendee_group_id)
    if p.status in ("APPROVED", "REJECTED"):
        raise ConflictError(
            "Cannot upload evidence to a reviewed payment",
            code=PAYMENT_ALREADY_REVIEWED,
        )
    url = generate_upload_url(
        bucket="payment-evidence",
        object_key=f"{p.event_id}/{payment_id}/{uuid4().hex}",
    )
    return EvidenceUrlResponse(upload_url=url)


class EvidenceRegister(CamelModel):
    file_url: str
    mime_type: str | None = None
    evidence_type: str = Field(default="RECEIPT", max_length=64)


@router.post("/payments/{payment_id}/evidence", response_model=dict)
def register_evidence(
    payment_id: UUID,
    body: EvidenceRegister,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> dict:
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    _buyer_group(db, claims, p.attendee_group_id)
    ev = PaymentEvidence(
        payment_id=payment_id,
        file_url=body.file_url,
        mime_type=body.mime_type,
        evidence_type=body.evidence_type,
        uploaded_by_actor_type="BUYER",
    )
    db.add(ev)
    db.flush()
    return {"id": str(ev.id)}
