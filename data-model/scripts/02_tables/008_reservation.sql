CREATE TABLE IF NOT EXISTS events.reservation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    attendee_group_id UUID NOT NULL,
    payment_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    total_spots_reserved INTEGER NOT NULL,
    code_sequence_start INTEGER,
    code_sequence_end INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.table_reservation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL,
    event_id UUID NOT NULL,
    attendee_group_id UUID NOT NULL,
    layout_table_id UUID NOT NULL,
    payment_id UUID NOT NULL,
    spots_reserved INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_actor_type VARCHAR(32) NOT NULL DEFAULT 'BUYER',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.reservation_code_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    reservation_code VARCHAR(32) NOT NULL,
    code_sequence_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.reservation_consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    attendee_group_id UUID NOT NULL,
    policy_document_id UUID NOT NULL,
    terms_document_id UUID NOT NULL,
    accepted_by_actor_type VARCHAR(32) NOT NULL,
    accepted_by_user_id UUID,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    policy_version_label VARCHAR(64) NOT NULL,
    terms_version_label VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS events.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    event_id UUID,
    actor_user_id UUID,
    actor_type VARCHAR(32) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID,
    action VARCHAR(128) NOT NULL,
    payload_json JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id VARCHAR(64)
);
