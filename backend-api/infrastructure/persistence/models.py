"""SQLAlchemy models mapped 1:1 to data-model/scripts (schema events)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Double,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.persistence.base import Base

SCHEMA = {"schema": "events"}


class Tenant(Base):
    __tablename__ = "tenant"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_tenant_slug"),
        CheckConstraint("status IN ('ACTIVE','SUSPENDED','ARCHIVED')", name="ck_tenant_status"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    venues: Mapped[list[Venue]] = relationship(back_populates="tenant")
    events: Mapped[list[Event]] = relationship(back_populates="tenant")


class StaffUser(Base):
    __tablename__ = "staff_user"
    __table_args__ = (
        UniqueConstraint("email", name="uq_staff_user_email"),
        CheckConstraint("status IN ('ACTIVE','INVITED','DISABLED')", name="ck_staff_user_status"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320))
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_subject: Mapped[str | None] = mapped_column(String(320), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Venue(Base):
    __tablename__ = "venue"
    __table_args__ = (SCHEMA,)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.tenant.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped[Tenant] = relationship(back_populates="venues")
    layouts: Mapped[list[Layout]] = relationship(back_populates="venue")


class Layout(Base):
    __tablename__ = "layout"
    __table_args__ = (
        CheckConstraint("status IN ('DRAFT','PUBLISHED','ARCHIVED')", name="ck_layout_status"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.venue.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    background_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    geometry_meta_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    venue: Mapped[Venue] = relationship(back_populates="layouts")
    zones: Mapped[list[Zone]] = relationship(back_populates="layout")
    tables: Mapped[list[LayoutTable]] = relationship(back_populates="layout")


class Zone(Base):
    __tablename__ = "zone"
    __table_args__ = (SCHEMA,)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    layout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.layout.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(200))
    geometry_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    is_public_selectable: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    layout: Mapped[Layout] = relationship(back_populates="zones")


class FixedFeature(Base):
    __tablename__ = "fixed_feature"
    __table_args__ = (SCHEMA,)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    layout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.layout.id", ondelete="CASCADE")
    )
    feature_type: Mapped[str] = mapped_column(String(64))
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    geometry_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class LayoutTable(Base):
    __tablename__ = "layout_table"
    __table_args__ = (
        UniqueConstraint("layout_id", "code", name="uq_layout_table_layout_code"),
        CheckConstraint("table_capacity_limit > 0", name="ck_layout_table_capacity"),
        CheckConstraint(
            "current_occupied_spots >= 0 AND current_occupied_spots <= table_capacity_limit",
            name="ck_layout_table_occupied",
        ),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    layout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.layout.id", ondelete="CASCADE")
    )
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.zone.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(64))
    table_capacity_limit: Mapped[int] = mapped_column(Integer, default=10)
    current_occupied_spots: Mapped[int] = mapped_column(Integer, default=0)
    position_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    rotation_deg: Mapped[Decimal | None] = mapped_column(Numeric(8, 3), nullable=True)
    is_public_selectable: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    layout: Mapped[Layout] = relationship(back_populates="tables")


class Event(Base):
    __tablename__ = "event"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT','PREPARING','OPEN','CLOSED','ARCHIVED')", name="ck_event_status"
        ),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.tenant.id", ondelete="CASCADE")
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.venue.id", ondelete="RESTRICT")
    )
    name: Mapped[str] = mapped_column(String(300))
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    venue_name_snapshot: Mapped[str | None] = mapped_column(String(300), nullable=True)
    venue_address_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    venue_lat: Mapped[float | None] = mapped_column(Double, nullable=True)
    venue_lon: Mapped[float | None] = mapped_column(Double, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped[Tenant] = relationship(back_populates="events")
    configuration: Mapped[EventConfiguration | None] = relationship(
        back_populates="event", uselist=False
    )
    layout_bindings: Mapped[list[EventLayoutBinding]] = relationship(back_populates="event")
    policy_documents: Mapped[list[EventPolicyDocument]] = relationship(back_populates="event")


class EventConfiguration(Base):
    __tablename__ = "event_configuration"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_event_configuration_event"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    presale_start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    presale_end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sale_start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sale_end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    max_presale_tickets: Mapped[int] = mapped_column(Integer, default=4)
    max_sale_tickets: Mapped[int] = mapped_column(Integer, default=3)
    map_visibility_policy: Mapped[str] = mapped_column(String(64), default="AFTER_PAYMENT_APPROVED")
    ticket_price: Mapped[int] = mapped_column(Integer, default=50000)
    payment_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped[Event] = relationship(back_populates="configuration")


class EventLayoutBinding(Base):
    __tablename__ = "event_layout_binding"
    __table_args__ = (SCHEMA,)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    layout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.layout.id", ondelete="RESTRICT")
    )
    layout_version: Mapped[int] = mapped_column(Integer)
    bound_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped[Event] = relationship(back_populates="layout_bindings")


class EventPolicyDocument(Base):
    __tablename__ = "event_policy_document"
    __table_args__ = (
        UniqueConstraint(
            "event_id", "document_type", "version_label", name="uq_policy_event_type_version"
        ),
        CheckConstraint("status IN ('DRAFT','PUBLISHED','ARCHIVED')", name="ck_policy_status"),
        CheckConstraint("document_type IN ('DATA_POLICY','EVENT_TERMS')", name="ck_policy_type"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    document_type: Mapped[str] = mapped_column(String(32))
    version_label: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(300))
    content_markdown: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.staff_user.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped[Event] = relationship(back_populates="policy_documents")


class UserTenantMembership(Base):
    __tablename__ = "user_tenant_membership"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_utm_tenant_user"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.tenant.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.staff_user.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EventOrganizerAssignment(Base):
    __tablename__ = "event_organizer_assignment"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_eoa_event_user"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.staff_user.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StudentImportBatch(Base):
    __tablename__ = "student_import_batch"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','PROCESSING','COMPLETED','FAILED')",
            name="ck_sib_status",
        ),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.staff_user.id", ondelete="SET NULL"), nullable=True
    )
    source_file_name: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    imported_rows: Mapped[int] = mapped_column(Integer, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    records: Mapped[list[StudentRecord]] = relationship(back_populates="batch")


class StudentRecord(Base):
    __tablename__ = "student_record"
    __table_args__ = (
        UniqueConstraint("event_id", "student_code", name="uq_student_record_event_code"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    import_batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.student_import_batch.id", ondelete="CASCADE")
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    student_code: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[str] = mapped_column(String(200))
    first_name: Mapped[str] = mapped_column(String(200))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    batch: Mapped[StudentImportBatch] = relationship(back_populates="records")


class AttendeeGroup(Base):
    __tablename__ = "attendee_group"
    __table_args__ = (
        UniqueConstraint(
            "event_id", "student_record_id", name="uq_attendee_group_event_student_record"
        ),
        CheckConstraint(
            "reservation_status IN ('NONE','PENDING','CONFIRMED','RELEASED','ADJUSTED')",
            name="ck_ag_reservation_status",
        ),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    student_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.student_record.id", ondelete="RESTRICT")
    )
    student_code_snapshot: Mapped[str] = mapped_column(String(128))
    display_name: Mapped[str | None] = mapped_column(String(400), nullable=True)
    code_consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.payment.id", ondelete="SET NULL"), nullable=True
    )
    approved_ticket_count: Mapped[int] = mapped_column(Integer, default=0)
    reservation_status: Mapped[str] = mapped_column(String(32), default="NONE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    participants: Mapped[list[Participant]] = relationship(back_populates="group")
    payments: Mapped[list[Payment]] = relationship(
        back_populates="attendee_group", foreign_keys="[Payment.attendee_group_id]"
    )


class Participant(Base):
    __tablename__ = "participant"
    __table_args__ = (SCHEMA,)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attendee_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.attendee_group.id", ondelete="CASCADE")
    )
    first_name: Mapped[str] = mapped_column(String(200))
    last_name: Mapped[str] = mapped_column(String(200))
    document_type: Mapped[str] = mapped_column(String(32))
    document_id: Mapped[str] = mapped_column(String(64))
    is_vegetarian: Mapped[bool] = mapped_column(Boolean, default=False)
    allergies: Mapped[str] = mapped_column(Text, default="")
    mobile_phone: Mapped[str] = mapped_column(String(32))
    emergency_contact_name: Mapped[str] = mapped_column(String(200))
    emergency_contact_phone: Mapped[str] = mapped_column(String(32))
    has_reduced_mobility: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    group: Mapped[AttendeeGroup] = relationship(back_populates="participants")


class Payment(Base):
    __tablename__ = "payment"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED')",
            name="ck_payment_status",
        ),
        CheckConstraint("payment_type IN ('DIGITAL','CASH')", name="ck_payment_type"),
        CheckConstraint("ticket_quantity > 0", name="ck_payment_ticket_qty"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    attendee_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.attendee_group.id", ondelete="CASCADE")
    )
    payment_type: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    ticket_quantity: Mapped[int] = mapped_column(Integer)
    amount_cents: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="COP")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.staff_user.id", ondelete="SET NULL"), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    attendee_group: Mapped[AttendeeGroup] = relationship(
        back_populates="payments", foreign_keys=[attendee_group_id]
    )
    evidences: Mapped[list[PaymentEvidence]] = relationship(back_populates="payment")


class PaymentEvidence(Base):
    __tablename__ = "payment_evidence"
    __table_args__ = (SCHEMA,)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.payment.id", ondelete="CASCADE")
    )
    file_url: Mapped[str] = mapped_column(Text)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    evidence_type: Mapped[str] = mapped_column(String(64))
    uploaded_by_actor_type: Mapped[str] = mapped_column(String(32))
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payment: Mapped[Payment] = relationship(back_populates="evidences")


class Reservation(Base):
    __tablename__ = "reservation"
    __table_args__ = (
        CheckConstraint(
            "status IN ('CONFIRMED','RELEASED','ADJUSTED')", name="ck_reservation_status"
        ),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    attendee_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.attendee_group.id", ondelete="CASCADE")
    )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.payment.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(String(32), default="CONFIRMED")
    total_spots_reserved: Mapped[int] = mapped_column(Integer)
    code_sequence_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    code_sequence_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    table_reservations: Mapped[list[TableReservation]] = relationship(back_populates="reservation")
    code_assignments: Mapped[list[ReservationCodeAssignment]] = relationship(
        back_populates="reservation"
    )
    consent: Mapped[ReservationConsent | None] = relationship(
        back_populates="reservation", uselist=False
    )


class TableReservation(Base):
    __tablename__ = "table_reservation"
    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','RELEASED','MOVED')", name="ck_tr_status"),
        CheckConstraint("spots_reserved > 0", name="ck_tr_spots"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.reservation.id", ondelete="CASCADE")
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    attendee_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.attendee_group.id", ondelete="CASCADE")
    )
    layout_table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.layout_table.id", ondelete="RESTRICT")
    )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.payment.id", ondelete="RESTRICT")
    )
    spots_reserved: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    reserved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by_actor_type: Mapped[str] = mapped_column(String(32), default="BUYER")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reservation: Mapped[Reservation] = relationship(back_populates="table_reservations")


class ReservationCodeAssignment(Base):
    __tablename__ = "reservation_code_assignment"
    __table_args__ = (
        UniqueConstraint("event_id", "reservation_code", name="uq_rca_event_reservation_code"),
        UniqueConstraint("event_id", "code_sequence_number", name="uq_rca_event_sequence"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.reservation.id", ondelete="CASCADE")
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.participant.id", ondelete="RESTRICT")
    )
    reservation_code: Mapped[str] = mapped_column(String(32))
    code_sequence_number: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    reservation: Mapped[Reservation] = relationship(back_populates="code_assignments")


class ReservationConsent(Base):
    __tablename__ = "reservation_consent"
    __table_args__ = (
        UniqueConstraint("reservation_id", name="uq_reservation_consent_reservation"),
        SCHEMA,
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="CASCADE")
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.reservation.id", ondelete="CASCADE")
    )
    attendee_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.attendee_group.id", ondelete="CASCADE")
    )
    policy_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event_policy_document.id", ondelete="RESTRICT")
    )
    terms_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event_policy_document.id", ondelete="RESTRICT")
    )
    accepted_by_actor_type: Mapped[str] = mapped_column(String(32))
    accepted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.staff_user.id", ondelete="SET NULL"), nullable=True
    )
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    policy_version_label: Mapped[str] = mapped_column(String(64))
    terms_version_label: Mapped[str] = mapped_column(String(64))

    reservation: Mapped[Reservation] = relationship(back_populates="consent")


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (SCHEMA,)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.tenant.id", ondelete="SET NULL"), nullable=True
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.event.id", ondelete="SET NULL"), nullable=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.staff_user.id", ondelete="SET NULL"), nullable=True
    )
    actor_type: Mapped[str] = mapped_column(String(32))
    entity_type: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(128))
    payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
