"""Cumulative commercial-stage caps (RN-TIME-02/03) per attendee group."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from domain.error_codes import STAGE_LIMIT_EXCEEDED
from domain.exceptions import ValidationError
from infrastructure.persistence.models import AttendeeGroup, EventConfiguration, Payment


def _anchor_datetime(p: Payment) -> datetime | None:
    if p.submitted_at is not None:
        return p.submitted_at
    if p.status == "APPROVED" and p.approved_at is not None:
        return p.approved_at
    return p.created_at


def _bucket_for_anchor(cfg: EventConfiguration, anchor: datetime) -> str | None:
    if cfg.presale_start_date <= anchor <= cfg.presale_end_date:
        return "presale"
    if cfg.sale_start_date <= anchor <= cfg.sale_end_date:
        return "sale"
    return None


def _committed_in_bucket(
    db: Session,
    *,
    group_id: UUID,
    event_id: UUID,
    cfg: EventConfiguration,
    bucket: str,
    exclude_payment_id: UUID | None,
) -> int:
    total = 0
    rows = list(
        db.execute(
            select(Payment).where(
                Payment.attendee_group_id == group_id,
                Payment.event_id == event_id,
                Payment.status.in_(("APPROVED", "PENDING_APPROVAL")),
            )
        ).scalars()
    )
    for p in rows:
        if exclude_payment_id is not None and p.id == exclude_payment_id:
            continue
        anchor = _anchor_datetime(p)
        if anchor is None:
            continue
        b = _bucket_for_anchor(cfg, anchor)
        if b == bucket:
            total += int(p.ticket_quantity)
    return total


def assert_stage_ticket_capacity(
    db: Session,
    *,
    event_id: UUID,
    group_id: UUID,
    requested: int,
    exclude_payment_id: UUID | None = None,
) -> None:
    """Raise ValidationError if cumulative APPROVED+PENDING in the current stage would exceed the cap."""
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    if cfg is None:
        return
    now = datetime.now(UTC)
    if cfg.presale_start_date <= now <= cfg.presale_end_date:
        committed = _committed_in_bucket(
            db,
            group_id=group_id,
            event_id=event_id,
            cfg=cfg,
            bucket="presale",
            exclude_payment_id=exclude_payment_id,
        )
        if committed + requested > cfg.max_presale_tickets:
            raise ValidationError(
                "Ya alcanzaste el máximo de boletas permitidas en preventa para este evento.",
                code=STAGE_LIMIT_EXCEEDED,
            )
        if requested > cfg.max_presale_tickets:
            raise ValidationError(
                f"En preventa solo se permiten hasta {cfg.max_presale_tickets} boletas por solicitud.",
                code=STAGE_LIMIT_EXCEEDED,
            )
    elif cfg.sale_start_date <= now <= cfg.sale_end_date:
        committed = _committed_in_bucket(
            db,
            group_id=group_id,
            event_id=event_id,
            cfg=cfg,
            bucket="sale",
            exclude_payment_id=exclude_payment_id,
        )
        if committed + requested > cfg.max_sale_tickets:
            raise ValidationError(
                "Ya alcanzaste el máximo de boletas permitidas en venta general para este evento.",
                code=STAGE_LIMIT_EXCEEDED,
            )
        if requested > cfg.max_sale_tickets:
            raise ValidationError(
                f"En venta general solo se permiten hasta {cfg.max_sale_tickets} boletas por solicitud.",
                code=STAGE_LIMIT_EXCEEDED,
            )


def assert_approval_fits_bucket(
    db: Session,
    *,
    payment: Payment,
    cfg: EventConfiguration,
    approved_count: int,
) -> None:
    """Validate committee approval does not break cumulative caps for the payment's commercial bucket."""
    anchor = _anchor_datetime(payment)
    if anchor is None:
        return
    bucket = _bucket_for_anchor(cfg, anchor)
    if bucket is None:
        return
    exclude_id = payment.id
    if bucket == "presale":
        others = _committed_in_bucket(
            db,
            group_id=payment.attendee_group_id,
            event_id=payment.event_id,
            cfg=cfg,
            bucket="presale",
            exclude_payment_id=exclude_id,
        )
        if others + approved_count > cfg.max_presale_tickets:
            raise ValidationError(
                "Aprobar esta cantidad superaría el tope acumulado de preventa para el estudiante.",
                code=STAGE_LIMIT_EXCEEDED,
            )
    elif bucket == "sale":
        others = _committed_in_bucket(
            db,
            group_id=payment.attendee_group_id,
            event_id=payment.event_id,
            cfg=cfg,
            bucket="sale",
            exclude_payment_id=exclude_id,
        )
        if others + approved_count > cfg.max_sale_tickets:
            raise ValidationError(
                "Aprobar esta cantidad superaría el tope acumulado de venta general para el estudiante.",
                code=STAGE_LIMIT_EXCEEDED,
            )


def sum_approved_tickets_for_group(db: Session, group_id: UUID, event_id: UUID) -> int:
    q = db.execute(
        select(func.coalesce(func.sum(Payment.ticket_quantity), 0)).where(
            Payment.attendee_group_id == group_id,
            Payment.event_id == event_id,
            Payment.status == "APPROVED",
        )
    ).scalar_one()
    return int(q)


def latest_approved_payment_id(db: Session, group_id: UUID, event_id: UUID) -> UUID | None:
    return db.execute(
        select(Payment.id)
        .where(
            Payment.attendee_group_id == group_id,
            Payment.event_id == event_id,
            Payment.status == "APPROVED",
        )
        .order_by(Payment.approved_at.desc().nulls_last(), Payment.id.desc())
        .limit(1)
    ).scalar_one_or_none()


def current_max_participants_per_group(cfg: EventConfiguration) -> int:
    """Max attendees the buyer may register for this event, following the active commercial stage.

    Mirrors payment caps: preventa → max_presale_tickets, venta general → max_sale_tickets.
    """
    now = datetime.now(UTC)
    if cfg.presale_start_date <= now <= cfg.presale_end_date:
        return int(cfg.max_presale_tickets)
    if cfg.sale_start_date <= now <= cfg.sale_end_date:
        return int(cfg.max_sale_tickets)
    if now < cfg.presale_start_date:
        return int(cfg.max_presale_tickets)
    if now > cfg.sale_end_date:
        return int(cfg.max_sale_tickets)
    # Between presale end and general sale start (no overlapping window)
    return int(min(cfg.max_presale_tickets, cfg.max_sale_tickets))


def refresh_group_approved_ticket_count(db: Session, group_id: UUID) -> None:
    g_row = db.get(AttendeeGroup, group_id)
    if g_row is None:
        return
    total = db.execute(
        select(func.coalesce(func.sum(Payment.ticket_quantity), 0)).where(
            Payment.attendee_group_id == group_id,
            Payment.status == "APPROVED",
        )
    ).scalar_one()
    g_row.approved_ticket_count = int(total)
