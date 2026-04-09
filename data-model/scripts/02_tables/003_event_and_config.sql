CREATE TABLE IF NOT EXISTS events.event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    venue_id UUID NOT NULL,
    name VARCHAR(300) NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    venue_name_snapshot VARCHAR(300),
    venue_address_snapshot TEXT,
    venue_lat DOUBLE PRECISION,
    venue_lon DOUBLE PRECISION,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.event_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    presale_start_date TIMESTAMPTZ NOT NULL,
    presale_end_date TIMESTAMPTZ NOT NULL,
    sale_start_date TIMESTAMPTZ NOT NULL,
    sale_end_date TIMESTAMPTZ NOT NULL,
    max_presale_tickets INTEGER NOT NULL DEFAULT 4,
    max_sale_tickets INTEGER NOT NULL DEFAULT 3,
    map_visibility_policy VARCHAR(64) NOT NULL DEFAULT 'AFTER_PAYMENT_APPROVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.event_layout_binding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    layout_id UUID NOT NULL,
    layout_version INTEGER NOT NULL,
    bound_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.event_policy_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    document_type VARCHAR(32) NOT NULL,
    version_label VARCHAR(64) NOT NULL,
    title VARCHAR(300) NOT NULL,
    content_markdown TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
