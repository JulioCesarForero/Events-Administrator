from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from sqlalchemy import select

from infrastructure.persistence.models import (
    AttendeeGroup,
    Event,
    EventPolicyDocument,
    ReservationConsent,
)
from shared.api.deps import (
    BuyerClaimsDep,
    DbSession,
    StaffUserDep,
    buyer_group_id,
    ensure_event_staff_access,
)
from shared.api.schemas import CamelModel, CamelOrmModel

router = APIRouter(tags=["legal"])


class LegalDocCreate(CamelModel):
    document_type: str = Field(max_length=32)
    version_label: str = Field(max_length=64)
    title: str = Field(max_length=300)
    content_markdown: str


class LegalDocOut(CamelOrmModel):
    id: UUID
    event_id: UUID
    document_type: str
    version_label: str
    title: str
    status: str


class PublishedLegalDocOut(CamelOrmModel):
    id: UUID
    event_id: UUID
    document_type: str
    version_label: str
    title: str
    content_markdown: str
    status: str
    published_at: datetime | None = None


class LegalDocPatch(CamelModel):
    title: str | None = Field(default=None, max_length=300)
    content_markdown: str | None = None


@router.get("/events/{event_id}/legal-documents", response_model=list[LegalDocOut])
def list_legal_docs(
    event_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> list[EventPolicyDocument]:
    ensure_event_staff_access(db, staff, event_id)
    return list(
        db.execute(
            select(EventPolicyDocument)
            .where(EventPolicyDocument.event_id == event_id)
            .order_by(EventPolicyDocument.created_at)
        ).scalars()
    )


@router.post("/events/{event_id}/legal-documents", response_model=LegalDocOut)
def create_legal_doc(
    event_id: UUID,
    body: LegalDocCreate,
    db: DbSession,
    staff: StaffUserDep,
) -> EventPolicyDocument:
    ensure_event_staff_access(db, staff, event_id)
    doc = EventPolicyDocument(
        event_id=event_id,
        document_type=body.document_type,
        version_label=body.version_label,
        title=body.title,
        content_markdown=body.content_markdown,
        status="DRAFT",
        created_by_user_id=staff.id,
    )
    db.add(doc)
    db.flush()
    return doc


@router.patch("/legal-documents/{document_id}", response_model=LegalDocOut)
def patch_legal_doc(
    document_id: UUID,
    body: LegalDocPatch,
    db: DbSession,
    staff: StaffUserDep,
) -> EventPolicyDocument:
    doc = db.get(EventPolicyDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    ensure_event_staff_access(db, staff, doc.event_id)
    if doc.status == "PUBLISHED":
        raise HTTPException(status_code=409, detail="Cannot edit published document")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(doc, k, v)
    db.flush()
    return doc


@router.post("/legal-documents/{document_id}/publish", response_model=LegalDocOut)
def publish_legal_doc(
    document_id: UUID,
    db: DbSession,
    staff: StaffUserDep,
) -> EventPolicyDocument:
    doc = db.get(EventPolicyDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    ensure_event_staff_access(db, staff, doc.event_id)
    doc.status = "PUBLISHED"
    doc.published_at = datetime.now(UTC)
    db.flush()
    return doc


@router.get(
    "/portal/events/{event_id}/published-legal-documents",
    response_model=list[PublishedLegalDocOut],
)
def list_published_legal_docs(
    event_id: UUID,
    db: DbSession,
    document_type: str | None = Query(default=None, alias="type", max_length=32),
) -> list[EventPolicyDocument]:
    """Public endpoint so buyers (and the login screen) can read the latest
    published Política de tratamiento de datos / Términos y condiciones
    for an event without authentication."""
    if db.get(Event, event_id) is None:
        raise HTTPException(status_code=404, detail="Event not found")
    stmt = select(EventPolicyDocument).where(
        EventPolicyDocument.event_id == event_id,
        EventPolicyDocument.status == "PUBLISHED",
    )
    if document_type:
        stmt = stmt.where(EventPolicyDocument.document_type == document_type)
    stmt = stmt.order_by(EventPolicyDocument.published_at.desc().nullslast())
    return list(db.execute(stmt).scalars())


class AcceptedLegalOut(CamelModel):
    policy_version_label: str
    terms_version_label: str
    accepted_at: datetime


@router.get(
    "/portal/events/{event_id}/accepted-legal-documents",
    response_model=AcceptedLegalOut | None,
)
def get_accepted_legal(
    event_id: UUID,
    db: DbSession,
    claims: BuyerClaimsDep,
) -> AcceptedLegalOut | None:
    gid = buyer_group_id(claims)
    g = db.get(AttendeeGroup, gid)
    if g is None or g.event_id != event_id:
        raise HTTPException(status_code=403, detail="Invalid session")
    row = db.execute(
        select(ReservationConsent)
        .where(
            ReservationConsent.event_id == event_id,
            ReservationConsent.attendee_group_id == gid,
        )
        .order_by(ReservationConsent.accepted_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        return None
    return AcceptedLegalOut(
        policy_version_label=row.policy_version_label,
        terms_version_label=row.terms_version_label,
        accepted_at=row.accepted_at,
    )
