CREATE TABLE IF NOT EXISTS events.venue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    default_timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.layout (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    background_image_url TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    geometry_meta_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events.zone (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    geometry_json JSONB,
    is_public_selectable BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events.fixed_feature (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL,
    feature_type VARCHAR(64) NOT NULL,
    label VARCHAR(200),
    geometry_json JSONB
);

CREATE TABLE IF NOT EXISTS events.layout_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL,
    zone_id UUID,
    code VARCHAR(64) NOT NULL,
    table_capacity_limit INTEGER NOT NULL DEFAULT 10,
    current_occupied_spots INTEGER NOT NULL DEFAULT 0,
    position_json JSONB,
    rotation_deg NUMERIC(8, 3),
    is_public_selectable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
