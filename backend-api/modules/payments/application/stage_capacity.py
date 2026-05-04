"""Cumulative commercial-stage caps (RN-TIME-02/03) per attendee group."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from domain.error_codes import STAGE_LIMIT_EXCEEDED
from domain.exceptions import ValidationError
from infrastructure.persistence.models import (
    AttendeeGroup,
    EventConfiguration,
    Payment,
    Reservation,
)


def _anchor_datetime(p: Payment) -> datetime | None:
    if p.submitted_at is not None:
        return p.submitted_at
    if p.status == "APPROVED" and p.approved_at is not None:
        return p.approved_at
    return p.created_at


def resolve_commercial_bucket(cfg: EventConfiguration, when: datetime) -> str:
    """Map a timestamp to presale, sale, or between-windows bucket (never uncapped None).

    Payments or approvals outside presale/sale calendars still count against a defined cap
    so two concurrent approvals cannot bypass limits via an undefined bucket.
    """
    if cfg.presale_start_date <= when <= cfg.presale_end_date:
        return "presale"
    if cfg.sale_start_date <= when <= cfg.sale_end_date:
        return "sale"
    if when < cfg.presale_start_date:
        return "presale"
    if when > cfg.sale_end_date:
        return "sale"
    if cfg.presale_end_date < when < cfg.sale_start_date:
        return "between"
    return "between"


def _cap_for_bucket(cfg: EventConfiguration, bucket: str) -> int:
    if bucket == "presale":
        return int(cfg.max_presale_tickets)
    if bucket == "sale":
        return int(cfg.max_sale_tickets)
    return min(int(cfg.max_presale_tickets), int(cfg.max_sale_tickets))


def lock_attendee_group_for_capacity(db: Session, group_id: UUID) -> None:
    """Serialize submit/approve/create paths that change ticket counts for one buyer group."""
    row = db.execute(
        select(AttendeeGroup.id).where(AttendeeGroup.id == group_id).with_for_update()
    ).first()
    if row is None:
        raise ValidationError("Grupo de asistentes no encontrado.")


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
        b = resolve_commercial_bucket(cfg, anchor)
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
    bucket = resolve_commercial_bucket(cfg, now)
    cap = _cap_for_bucket(cfg, bucket)
    committed = _committed_in_bucket(
        db,
        group_id=group_id,
        event_id=event_id,
        cfg=cfg,
        bucket=bucket,
        exclude_payment_id=exclude_payment_id,
    )
    if committed + requested > cap:
        if bucket == "presale":
            msg = "Ya alcanzaste el máximo de boletas permitidas en preventa para este evento."
        elif bucket == "sale":
            msg = "Ya alcanzaste el máximo de boletas permitidas en venta general para este evento."
        else:
            msg = (
                "Ya alcanzaste el máximo de boletas permitidas en esta ventana del evento "
                "(entre preventa y venta general)."
            )
        raise ValidationError(msg, code=STAGE_LIMIT_EXCEEDED)
    if requested > cap:
        if bucket == "presale":
            msg = f"En preventa solo se permiten hasta {cap} boletas por solicitud."
        elif bucket == "sale":
            msg = f"En venta general solo se permiten hasta {cap} boletas por solicitud."
        else:
            msg = f"En esta ventana solo se permiten hasta {cap} boletas por solicitud."
        raise ValidationError(msg, code=STAGE_LIMIT_EXCEEDED)


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
    bucket = resolve_commercial_bucket(cfg, anchor)
    cap = _cap_for_bucket(cfg, bucket)
    exclude_id = payment.id
    others = _committed_in_bucket(
        db,
        group_id=payment.attendee_group_id,
        event_id=payment.event_id,
        cfg=cfg,
        bucket=bucket,
        exclude_payment_id=exclude_id,
    )
    if others + approved_count > cap:
        if bucket == "presale":
            msg = "Aprobar esta cantidad superaría el tope acumulado de preventa para el estudiante."
        elif bucket == "sale":
            msg = "Aprobar esta cantidad superaría el tope acumulado de venta general para el estudiante."
        else:
            msg = (
                "Aprobar esta cantidad superaría el tope acumulado permitido para el estudiante "
                "en esta ventana comercial."
            )
        raise ValidationError(msg, code=STAGE_LIMIT_EXCEEDED)


def sum_approved_tickets_for_group(db: Session, group_id: UUID, event_id: UUID) -> int:
    q = db.execute(
        select(func.coalesce(func.sum(Payment.ticket_quantity), 0)).where(
            Payment.attendee_group_id == group_id,
            Payment.event_id == event_id,
            Payment.status == "APPROVED",
        )
    ).scalar_one()
    return int(q)


def sum_confirmed_reservation_spots(db: Session, group_id: UUID, event_id: UUID) -> int:
    """RN-RES-08: total spots locked in CONFIRMED reservations for this group/event."""
    q = db.execute(
        select(func.coalesce(func.sum(Reservation.total_spots_reserved), 0)).where(
            Reservation.attendee_group_id == group_id,
            Reservation.event_id == event_id,
            Reservation.status == "CONFIRMED",
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
    return _cap_for_bucket(cfg, resolve_commercial_bucket(cfg, now))


def refresh_group_approved_ticket_count(db: Session, group_id: UUID) -> None:
    g_row = db.get(AttendeeGroup, group_id)
    if g_row is None:
        return
    total = db.execute(
        select(func.coalesce(func.sum(Payment.ticket_quantity), 0)).where(
            Payment.attendee_group_id == group_id,
            Payment.event_id == g_row.event_id,
            Payment.status == "APPROVED",
        )
    ).scalar_one()
    g_row.approved_ticket_count = int(total)
