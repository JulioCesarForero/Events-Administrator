from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import Field

from infrastructure.persistence.models import StudentRecord
from modules.students.application.student_service import (
    delete_student,
    get_student,
    list_students,
    update_student,
)
from shared.api.deps import DbSession, StaffUserDep, ensure_event_staff_access
from shared.api.schemas import CamelModel, CamelOrmModel

router = APIRouter(tags=["students"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StudentOut(CamelOrmModel):
    id: UUID
    event_id: UUID
    import_batch_id: UUID
    student_code: str
    first_name: str
    last_name: str
    is_active: bool
    metadata_json: dict[str, Any] | None = None
    created_at: datetime


class StudentListResponse(CamelModel):
    items: list[StudentOut]
    total: int
    offset: int
    limit: int


class StudentUpdate(CamelModel):
    student_code: str | None = Field(default=None, max_length=128)
    first_name: str | None = Field(default=None, max_length=200)
    last_name: str | None = Field(default=None, max_length=200)
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/events/{event_id}/students",
    response_model=StudentListResponse,
)
def list_event_students(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
    search: str | None = Query(default=None, max_length=200),
    is_active: bool | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> StudentListResponse:
    ensure_event_staff_access(db, staff, event_id)
    rows, total = list_students(
        db, event_id, search=search, is_active=is_active, offset=offset, limit=limit
    )
    return StudentListResponse(
        items=[StudentOut.model_validate(r) for r in rows],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/events/{event_id}/students/{student_id}",
    response_model=StudentOut,
)
def get_event_student(
    event_id: UUID,
    student_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> StudentRecord:
    ensure_event_staff_access(db, staff, event_id)
    return get_student(db, event_id, student_id)


@router.patch(
    "/events/{event_id}/students/{student_id}",
    response_model=StudentOut,
)
def patch_event_student(
    event_id: UUID,
    student_id: UUID,
    body: StudentUpdate,
    db: DbSession,
    staff: StaffUserDep,
) -> StudentRecord:
    ensure_event_staff_access(db, staff, event_id)
    return update_student(
        db,
        event_id,
        student_id,
        student_code=body.student_code,
        first_name=body.first_name,
        last_name=body.last_name,
        is_active=body.is_active,
    )


@router.delete(
    "/events/{event_id}/students/{student_id}",
    status_code=204,
)
def delete_event_student(
    event_id: UUID,
    student_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> None:
    ensure_event_staff_access(db, staff, event_id)
    delete_student(db, event_id, student_id)
