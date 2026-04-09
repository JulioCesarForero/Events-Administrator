CREATE TABLE IF NOT EXISTS events.tenant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE events.tenant IS 'Organización titular de datos (multi-tenant lógico)';

CREATE TABLE IF NOT EXISTS events.staff_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    password_hash TEXT,
    external_subject VARCHAR(320),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE events.staff_user IS 'Identidad del personal interno (comité, organizadores). Evita nombre reservado user en PostgreSQL';
