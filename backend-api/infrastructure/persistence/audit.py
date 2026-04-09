from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from infrastructure.persistence.models import AuditLog


def append_audit_log(
    db: Session,
    *,
    tenant_id: UUID | None,
    event_id: UUID | None,
    actor_user_id: UUID | None,
    actor_type: str,
    entity_type: str,
    entity_id: UUID | None,
    action: str,
    payload_json: dict[str, Any] | None = None,
    correlation_id: str | None = None,
) -> None:
    db.add(
        AuditLog(
            tenant_id=tenant_id,
            event_id=event_id,
            actor_user_id=actor_user_id,
            actor_type=actor_type,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            payload_json=payload_json,
            correlation_id=correlation_id,
        )
    )
