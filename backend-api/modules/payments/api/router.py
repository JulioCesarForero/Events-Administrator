from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from domain.exceptions import ConflictError, ValidationError
from infrastructure.persistence.audit import append_audit_log
from infrastructure.persistence.models import (
    AttendeeGroup,
    Event,
    Payment,
    PaymentEvidence,
)
from shared.api.deps import BuyerClaimsDep, DbSession, StaffUserDep, buyer_group_id, ensure_event_staff_access
from shared.exceptions.http_map import domain_error_to_http

router = APIRouter(tags=["payments"])


def _buyer_group(db, claims, group_id: UUID) -> AttendeeGroup:
    if buyer_group_id(claims) != group_id:
        raise HTTPException(status_code=403, detail="Not your group")
    g = db.get(AttendeeGroup, group_id)
    if g is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


class PaymentCreate(BaseModel):
    payment_type: str = Field(max_length=16)
    ticket_quantity: int = Field(ge=1)
    amount_cents: int | None = None
    currency: str = Field(default="COP", max_length=3)


class PaymentOut(BaseModel):
    id: UUID
    event_id: UUID
    attendee_group_id: UUID
    status: str
    ticket_quantity: int
    payment_type: str

    model_config = {"from_attributes": True}


@router.post("/groups/{group_id}/payments", response_model=PaymentOut)
def create_payment(
    group_id: UUID,
    body: PaymentCreate,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Payment:
    g = _buyer_group(db, claims, group_id)
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


class PaymentPatch(BaseModel):
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
    if p.status != "DRAFT":
        try:
            raise ConflictError("Payment cannot be edited in current status")
        except ConflictError as e:
            raise domain_error_to_http(e) from e
    for k, v in body.model_dump(exclude_unset=True).items():
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
    _buyer_group(db, claims, p.attendee_group_id)
    if p.status != "DRAFT":
        try:
            raise ConflictError("Invalid payment state")
        except ConflictError as e:
            raise domain_error_to_http(e) from e
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


@router.post("/payments/{payment_id}/approve", response_model=PaymentOut)
def approve_payment(
    payment_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> Payment:
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    ensure_event_staff_access(db, staff, p.event_id)
    if p.status != "PENDING_APPROVAL":
        try:
            raise ConflictError("Payment is not pending approval")
        except ConflictError as e:
            raise domain_error_to_http(e) from e
    p.status = "APPROVED"
    p.approved_at = datetime.now(UTC)
    p.reviewed_by_user_id = staff.id
    g = db.get(AttendeeGroup, p.attendee_group_id)
    if g:
        g.approved_ticket_count = p.ticket_quantity
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


class RejectBody(BaseModel):
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
        try:
            raise ConflictError("Payment is not pending approval")
        except ConflictError as e:
            raise domain_error_to_http(e) from e
    p.status = "REJECTED"
    p.rejected_at = datetime.now(UTC)
    p.reviewed_by_user_id = staff.id
    p.rejection_reason = body.reason
    db.flush()
    return p


class CashPaymentCreate(BaseModel):
    attendee_group_id: UUID
    ticket_quantity: int = Field(ge=1)
    amount_cents: int | None = None
    currency: str = Field(default="COP", max_length=3)


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
    pay = Payment(
        event_id=event_id,
        attendee_group_id=body.attendee_group_id,
        payment_type="CASH",
        status="APPROVED",
        ticket_quantity=body.ticket_quantity,
        amount_cents=body.amount_cents,
        currency=body.currency,
        approved_at=datetime.now(UTC),
        reviewed_by_user_id=staff.id,
    )
    db.add(pay)
    g.current_payment_id = pay.id
    g.approved_ticket_count = body.ticket_quantity
    db.flush()
    return pay


class EvidenceUrlResponse(BaseModel):
    upload_url: str
    note: str = "Placeholder until object storage is integrated"


@router.post("/payments/{payment_id}/evidence-upload-url", response_model=EvidenceUrlResponse)
def evidence_upload_url(
    payment_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> EvidenceUrlResponse:
    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    _buyer_group(db, claims, p.attendee_group_id)
    return EvidenceUrlResponse(upload_url=f"https://storage.placeholder.local/{payment_id}")


class EvidenceRegister(BaseModel):
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
