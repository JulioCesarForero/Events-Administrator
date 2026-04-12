"""Read-only SQLAlchemy mappings for database views defined in data-model/scripts/06_views."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Table, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session

from infrastructure.persistence.base import Base


def table_availability_by_event(db: Session, event_id: uuid.UUID) -> list[dict[str, Any]]:
    """Query v_table_availability_by_event for a specific event."""
    rows = db.execute(
        text("""
            SELECT event_id, layout_table_id, table_code,
                   table_capacity_limit, stored_occupied_spots,
                   computed_active_spots, available_spots_computed
            FROM events.v_table_availability_by_event
            WHERE event_id = :eid
        """),
        {"eid": event_id},
    ).mappings().all()
    return [dict(r) for r in rows]


def group_payment_status(db: Session, event_id: uuid.UUID) -> list[dict[str, Any]]:
    """Query v_group_payment_status for a specific event."""
    rows = db.execute(
        text("""
            SELECT attendee_group_id, event_id, student_code_snapshot,
                   payment_id, payment_status, ticket_quantity,
                   approved_at, rejected_at, submitted_at
            FROM events.v_group_payment_status
            WHERE event_id = :eid
        """),
        {"eid": event_id},
    ).mappings().all()
    return [dict(r) for r in rows]


def event_reservation_summary(db: Session, event_id: uuid.UUID) -> dict[str, Any] | None:
    """Query v_event_reservation_summary for a specific event."""
    row = db.execute(
        text("""
            SELECT event_id, reservation_count, total_spots_confirmed
            FROM events.v_event_reservation_summary
            WHERE event_id = :eid
        """),
        {"eid": event_id},
    ).mappings().first()
    return dict(row) if row else None


def participant_reservation_codes(
    db: Session, attendee_group_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Query v_participant_reservation_codes for a group."""
    rows = db.execute(
        text("""
            SELECT participant_id, attendee_group_id, event_id,
                   reservation_id, reservation_code, code_sequence_number
            FROM events.v_participant_reservation_codes
            WHERE attendee_group_id = :gid
        """),
        {"gid": attendee_group_id},
    ).mappings().all()
    return [dict(r) for r in rows]


def event_current_policies(db: Session, event_id: uuid.UUID) -> list[dict[str, Any]]:
    """Query v_event_current_policies for a specific event."""
    rows = db.execute(
        text("""
            SELECT event_id, document_type, document_id,
                   version_label, title, published_at, status
            FROM events.v_event_current_policies
            WHERE event_id = :eid
        """),
        {"eid": event_id},
    ).mappings().all()
    return [dict(r) for r in rows]
