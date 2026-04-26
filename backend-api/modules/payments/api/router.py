from datetime import UTC, datetime
from urllib.parse import unquote, urlparse
from uuid import UUID

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
            evidence_type="CASH_RECEIPT_PHOTO",
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
    bucket: str
    object_key: str
    storage_path: str
    expires_in: int


class EvidenceUploadUrlRequest(CamelModel):
    mime_type: str = Field(default="application/octet-stream", max_length=150)
    file_name: str = Field(default="evidence.bin", max_length=300)
    size_bytes: int | None = Field(default=None, ge=0)


@router.post("/payments/{payment_id}/evidence-upload-url", response_model=EvidenceUrlResponse)
def evidence_upload_url(
    payment_id: UUID,
    body: EvidenceUploadUrlRequest,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> EvidenceUrlResponse:
    from infrastructure.storage.signed_urls import (
        build_object_ref,
        generate_upload_url,
        validate_upload_constraints,
    )
    from config.settings import settings

    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    _buyer_group(db, claims, p.attendee_group_id)
    if p.status in ("APPROVED", "REJECTED"):
        raise ConflictError(
            "Cannot upload evidence to a reviewed payment",
            code=PAYMENT_ALREADY_REVIEWED,
        )
    
    ev = db.get(Event, p.event_id)
    tenant_id = ev.tenant_id if ev else "default-tenant"

    validate_upload_constraints(
        purpose="evidence",
        content_type=body.mime_type,
        size_bytes=body.size_bytes,
    )
    
    object_ref = build_object_ref(
        purpose="evidence",
        filename=body.file_name or "evidence.bin",
        tenant_id=str(tenant_id),
        event_id=str(p.event_id),
        payment_id=str(payment_id),
    )
    url = generate_upload_url(
        bucket=object_ref.bucket,
        object_key=object_ref.object_key,
        content_type=body.mime_type,
    )
    return EvidenceUrlResponse(
        upload_url=url,
        bucket=object_ref.bucket,
        object_key=object_ref.object_key,
        storage_path=object_ref.storage_path,
        expires_in=settings.gcs_upload_url_ttl_seconds,
    )


class EvidenceRegister(CamelModel):
    file_url: str | None = None
    bucket: str | None = None
    object_key: str | None = None
    mime_type: str | None = None
    evidence_type: str = Field(default="DIGITAL_PROOF", max_length=64)
    storage_path: str | None = None
    file_name: str | None = Field(default=None, max_length=300)
    size_bytes: int | None = Field(default=None, ge=0)


@router.post("/payments/{payment_id}/evidence", response_model=dict)
def register_evidence(
    payment_id: UUID,
    body: EvidenceRegister,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> dict:
    from config.settings import settings

    def _parse_object_ref() -> tuple[str | None, str | None, str | None]:
        if body.storage_path and body.storage_path.startswith("gs://"):
            _, path_part = body.storage_path.split("gs://", 1)
            bucket, key = path_part.split("/", 1)
            return bucket, key, f"https://storage.googleapis.com/{bucket}/{key}"
        if body.bucket and body.object_key:
            return body.bucket, body.object_key, f"https://storage.googleapis.com/{body.bucket}/{body.object_key}"
        if body.file_url:
            parsed = urlparse(body.file_url)
            if parsed.netloc.endswith("storage.googleapis.com"):
                path = parsed.path.lstrip("/")
                if "/" in path:
                    bucket, key = path.split("/", 1)
                    return bucket, unquote(key), body.file_url
            marker = f"{settings.gcs_bucket_name}/"
            if marker in body.file_url:
                key = unquote(body.file_url.split(marker, 1)[1].split("?", 1)[0])
                bucket = settings.gcs_bucket_name
                return bucket, key, body.file_url.split("?", 1)[0]
        return None, None, body.file_url

    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    _buyer_group(db, claims, p.attendee_group_id)
    bucket, object_key, fallback_url = _parse_object_ref()
    canonical_storage_path = body.storage_path
    if not canonical_storage_path and bucket and object_key:
        canonical_storage_path = f"gs://{bucket}/{object_key}"
    canonical_file_url = fallback_url
    if bucket and object_key:
        canonical_file_url = f"https://storage.googleapis.com/{bucket}/{object_key}"
    if not canonical_file_url:
        raise HTTPException(status_code=400, detail="Missing file reference")

    ev = PaymentEvidence(
        payment_id=payment_id,
        file_url=canonical_file_url,
        mime_type=body.mime_type,
        evidence_type=body.evidence_type,
        uploaded_by_actor_type="BUYER",
        storage_path=canonical_storage_path,
        file_name=body.file_name,
        size_bytes=body.size_bytes,
    )
    db.add(ev)
    db.flush()
    return {"id": str(ev.id)}


class EvidenceOut(CamelOrmModel):
    id: UUID
    payment_id: UUID
    file_url: str
    mime_type: str | None = None
    evidence_type: str
    uploaded_by_actor_type: str
    storage_path: str | None = None
    view_url: str | None = None
    file_name: str | None = None
    size_bytes: int | None = None
    created_at: datetime


@router.get("/payments/{payment_id}/evidences", response_model=list[EvidenceOut])
def list_payment_evidences(
    payment_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[PaymentEvidence]:
    from infrastructure.storage.signed_urls import generate_download_url

    def _signed_view_url(row: PaymentEvidence) -> str | None:
        if not row.storage_path or not row.storage_path.startswith("gs://"):
            return None
        _, path_part = row.storage_path.split("gs://", 1)
        bucket, key = path_part.split("/", 1)
        try:
            return generate_download_url(bucket=bucket, object_key=key)
        except Exception:
            return None

    p = db.get(Payment, payment_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    ensure_event_staff_access(db, staff, p.event_id)
    evidences = list(
        db.execute(
            select(PaymentEvidence)
            .where(PaymentEvidence.payment_id == payment_id)
            .order_by(PaymentEvidence.created_at.desc())
        ).scalars()
    )
    for evidence in evidences:
        setattr(evidence, "view_url", _signed_view_url(evidence) or evidence.file_url)
    return evidences
