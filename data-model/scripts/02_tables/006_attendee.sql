CREATE TABLE IF NOT EXISTS events.attendee_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    student_record_id UUID NOT NULL,
    student_code_snapshot VARCHAR(128) NOT NULL,
    display_name VARCHAR(400),
    code_consumed_at TIMESTAMPTZ,
    current_payment_id UUID,
    approved_ticket_count INTEGER NOT NULL DEFAULT 0,
    reservation_status VARCHAR(32) NOT NULL DEFAULT 'NONE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.participant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendee_group_id UUID NOT NULL,
    first_name VARCHAR(200) NOT NULL,
    last_name VARCHAR(200) NOT NULL,
    document_type VARCHAR(32) NOT NULL,
    document_id VARCHAR(64) NOT NULL,
    is_vegetarian BOOLEAN NOT NULL DEFAULT false,
    allergies TEXT NOT NULL DEFAULT '',
    mobile_phone VARCHAR(32) NOT NULL,
    emergency_contact_name VARCHAR(200) NOT NULL,
    emergency_contact_phone VARCHAR(32) NOT NULL,
    has_reduced_mobility BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
