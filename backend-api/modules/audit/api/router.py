from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select

from infrastructure.persistence.models import AuditLog
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access
from shared.api.schemas import CamelOrmModel

router = APIRouter(tags=["audit"])


class AuditLogOut(CamelOrmModel):
    id: UUID
    occurred_at: datetime
    actor_type: str
    entity_type: str
    entity_id: UUID | None
    action: str
    payload_json: dict[str, Any] | None


@router.get("/events/{event_id}/audit-log", response_model=list[AuditLogOut])
def list_audit(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[AuditLog]:
    ensure_event_staff_access(db, staff, event_id)
    return list(
        db.execute(
            select(AuditLog)
            .where(AuditLog.event_id == event_id)
            .order_by(AuditLog.occurred_at.desc())
            .limit(500)
        ).scalars()
    )
