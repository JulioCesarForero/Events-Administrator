from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field

from shared.api.schemas import CamelModel, CamelOrmModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from infrastructure.persistence.models import AttendeeGroup, Event, EventConfiguration, Participant, StaffUser
from modules.attendees.domain.rules import ensure_participant_editable_window
from shared.api.deps import (
    BuyerClaimsDep,
    DbSession,
    StaffUserDep,
    buyer_event_id,
    buyer_group_id,
    ensure_event_staff_access,
)

router = APIRouter(tags=["attendees"])


def _get_group_for_buyer(db: Session, claims: dict, event_id: UUID) -> AttendeeGroup:
    gid = buyer_group_id(claims)
    ev = buyer_event_id(claims)
    if ev != event_id:
        raise HTTPException(status_code=403, detail="Token not valid for this event")
    g = db.get(AttendeeGroup, gid)
    if g is None or g.event_id != event_id:
        raise HTTPException(status_code=404, detail="Group not found")
    return g


class MyGroupOut(CamelOrmModel):
    group_id: UUID = Field(validation_alias="id")
    event_id: UUID
    student_code_snapshot: str
    display_name: str | None
    reservation_status: str
    approved_ticket_count: int


@router.get("/portal/events/{event_id}/my-group", response_model=MyGroupOut)
def get_my_group(
    event_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> AttendeeGroup:
    g = _get_group_for_buyer(db, claims, event_id)
    return g


class ParticipantCreate(CamelModel):
    first_name: str = Field(max_length=200)
    last_name: str = Field(max_length=200)
    document_type: str = Field(max_length=32)
    document_id: str = Field(max_length=64)
    is_vegetarian: bool = False
    allergies: str = ""
    mobile_phone: str = Field(max_length=32)
    emergency_contact_name: str = Field(max_length=200)
    emergency_contact_phone: str = Field(max_length=32)
    has_reduced_mobility: bool = False


class ParticipantOut(CamelOrmModel):
    id: UUID
    attendee_group_id: UUID
    first_name: str
    last_name: str


class ParticipantUpdate(CamelModel):
    first_name: str | None = Field(default=None, max_length=200)
    last_name: str | None = Field(default=None, max_length=200)
    document_type: str | None = Field(default=None, max_length=32)
    document_id: str | None = Field(default=None, max_length=64)
    is_vegetarian: bool | None = None
    allergies: str | None = None
    mobile_phone: str | None = Field(default=None, max_length=32)
    emergency_contact_name: str | None = Field(default=None, max_length=200)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    has_reduced_mobility: bool | None = None


def _load_event_for_group(db: Session, group: AttendeeGroup) -> Event:
    ev = db.get(Event, group.event_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return ev


def _event_timezone(db: Session, event_id: UUID) -> str | None:
    cfg = db.execute(
        select(EventConfiguration).where(EventConfiguration.event_id == event_id)
    ).scalar_one_or_none()
    return cfg.timezone if cfg else None


def _can_access_group(
    db: Session,
    staff: StaffUser | None,
    claims: dict | None,
    group_id: UUID,
) -> AttendeeGroup:
    g = db.get(AttendeeGroup, group_id)
    if g is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if staff is not None:
        ensure_event_staff_access(db, staff, g.event_id)
        return g
    if claims is not None:
        if buyer_group_id(claims) != group_id:
            raise HTTPException(status_code=403, detail="Not your group")
        return g
    raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/groups/{group_id}/participants", response_model=list[ParticipantOut])
def list_participants(
    group_id: UUID,
    db: DbSession,
    request: Request,
) -> list[Participant]:
    staff = getattr(request.state, "staff_user", None)
    claims = getattr(request.state, "buyer_claims", None)
    if staff is None and claims is None:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            from config.settings import settings
            from infrastructure.security.jwt_tokens import decode_token
            import jwt as _jwt
            try:
                payload = decode_token(token, settings.jwt_staff_audience)
                uid = payload.get("sub")
                if uid:
                    staff = db.get(StaffUser, UUID(uid))
            except _jwt.PyJWTError:
                pass
            if staff is None:
                try:
                    payload = decode_token(token, settings.jwt_buyer_audience)
                    if payload.get("typ") == "buyer":
                        claims = payload
                except _jwt.PyJWTError:
                    pass
    if staff is None and claims is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    _can_access_group(db, staff, claims, group_id)
    return list(
        db.execute(
            select(Participant).where(Participant.attendee_group_id == group_id)
        ).scalars()
    )


@router.post("/groups/{group_id}/participants", response_model=ParticipantOut)
def create_participant(
    group_id: UUID,
    body: ParticipantCreate,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Participant:
    g = _can_access_group(db, None, claims, group_id)
    ev = _load_event_for_group(db, g)
    tz = _event_timezone(db, ev.id)
    ensure_participant_editable_window(ev.event_date, timezone=tz)
    p = Participant(attendee_group_id=group_id, **body.model_dump())
    db.add(p)
    db.flush()
    return p


@router.patch("/participants/{participant_id}", response_model=ParticipantOut)
def update_participant(
    participant_id: UUID,
    body: ParticipantUpdate,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> Participant:
    p = db.get(Participant, participant_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    _can_access_group(db, None, claims, p.attendee_group_id)
    g = db.get(AttendeeGroup, p.attendee_group_id)
    assert g is not None
    ev = _load_event_for_group(db, g)
    tz = _event_timezone(db, ev.id)
    ensure_participant_editable_window(ev.event_date, timezone=tz)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    db.flush()
    return p
