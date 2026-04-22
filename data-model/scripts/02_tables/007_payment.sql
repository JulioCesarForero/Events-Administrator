CREATE TABLE IF NOT EXISTS events.payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    attendee_group_id UUID NOT NULL,
    payment_type VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    ticket_quantity INTEGER NOT NULL,
    amount_cents BIGINT,
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    reviewed_by_user_id UUID,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.payment_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(128),
    evidence_type VARCHAR(64) NOT NULL,
    uploaded_by_actor_type VARCHAR(32) NOT NULL,
    storage_path TEXT,
    file_name VARCHAR(300),
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE events.payment_evidence ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE events.payment_evidence ADD COLUMN IF NOT EXISTS file_name VARCHAR(300);
ALTER TABLE events.payment_evidence ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
