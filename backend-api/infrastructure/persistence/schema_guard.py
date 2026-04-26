from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class RequiredColumn:
    table_schema: str
    table_name: str
    column_name: str


REQUIRED_COLUMNS: tuple[RequiredColumn, ...] = (
    RequiredColumn("events", "event_configuration", "ticket_price"),
    RequiredColumn("events", "event_configuration", "payment_instructions"),
    RequiredColumn("events", "payment_evidence", "storage_path"),
    RequiredColumn("events", "payment_evidence", "file_name"),
    RequiredColumn("events", "payment_evidence", "size_bytes"),
)


def missing_required_columns(session: Session) -> list[str]:
    sql = text(
        """
        SELECT c.table_schema, c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE (c.table_schema, c.table_name, c.column_name) IN (
            ('events', 'event_configuration', 'ticket_price'),
            ('events', 'event_configuration', 'payment_instructions'),
            ('events', 'payment_evidence', 'storage_path'),
            ('events', 'payment_evidence', 'file_name'),
            ('events', 'payment_evidence', 'size_bytes')
        )
        """
    )
    rows = session.execute(sql).all()
    found = {(r[0], r[1], r[2]) for r in rows}
    missing = []
    for req in REQUIRED_COLUMNS:
        key = (req.table_schema, req.table_name, req.column_name)
        if key not in found:
            missing.append(".".join(key))
    return missing

