-- Grafo mínimo para pruebas: salón, layout, zona, mesa, evento, configuración, binding y legales publicados.
-- Requiere tenant `demo-org` y usuario `admin@demo.local` (ver 001_dev_reference.sql).

INSERT INTO events.venue (tenant_id, name, address, default_timezone)
SELECT t.id, 'Salón Demo', 'Dirección demo', 'America/Bogota'
FROM events.tenant t
WHERE t.slug = 'demo-org'
  AND NOT EXISTS (
    SELECT 1 FROM events.venue v WHERE v.tenant_id = t.id AND v.name = 'Salón Demo'
  );

INSERT INTO events.layout (venue_id, name, status, version)
SELECT v.id, 'Layout Demo', 'PUBLISHED', 1
FROM events.venue v
JOIN events.tenant t ON t.id = v.tenant_id AND t.slug = 'demo-org'
WHERE v.name = 'Salón Demo'
  AND NOT EXISTS (
    SELECT 1 FROM events.layout l WHERE l.venue_id = v.id AND l.name = 'Layout Demo'
  );

INSERT INTO events.zone (layout_id, name, sort_order)
SELECT l.id, 'Zona principal', 0
FROM events.layout l
JOIN events.venue v ON v.id = l.venue_id
JOIN events.tenant t ON t.id = v.tenant_id AND t.slug = 'demo-org'
WHERE l.name = 'Layout Demo'
  AND NOT EXISTS (
    SELECT 1 FROM events.zone z WHERE z.layout_id = l.id AND z.name = 'Zona principal'
  );

INSERT INTO events.layout_table (layout_id, zone_id, code, table_capacity_limit, current_occupied_spots, position_json)
SELECT l.id, z.id, 'M-01', 10, 0, '{"x":0,"y":0}'::jsonb
FROM events.layout l
JOIN events.zone z ON z.layout_id = l.id AND z.name = 'Zona principal'
JOIN events.venue v ON v.id = l.venue_id
JOIN events.tenant t ON t.id = v.tenant_id AND t.slug = 'demo-org'
WHERE l.name = 'Layout Demo'
  AND NOT EXISTS (
    SELECT 1 FROM events.layout_table lt WHERE lt.layout_id = l.id AND lt.code = 'M-01'
  );

INSERT INTO events.event (
  tenant_id, venue_id, name, event_date, starts_at, ends_at,
  venue_name_snapshot, venue_address_snapshot, venue_lat, venue_lon, status
)
SELECT
  t.id,
  v.id,
  'Evento Demo MVP',
  TIMESTAMPTZ '2026-12-15 19:00:00+00',
  TIMESTAMPTZ '2026-12-15 19:00:00+00',
  TIMESTAMPTZ '2026-12-15 23:59:00+00',
  'Centro Demo',
  'Calle Demo',
  4.71,
  -74.07,
  'PREPARING'
FROM events.tenant t
JOIN events.venue v ON v.tenant_id = t.id AND v.name = 'Salón Demo'
WHERE t.slug = 'demo-org'
  AND NOT EXISTS (
    SELECT 1 FROM events.event e WHERE e.tenant_id = t.id AND e.name = 'Evento Demo MVP'
  );

INSERT INTO events.event_configuration (
  event_id, timezone,
  presale_start_date, presale_end_date,
  sale_start_date, sale_end_date,
  max_presale_tickets, max_sale_tickets
)
SELECT
  e.id,
  'America/Bogota',
  TIMESTAMPTZ '2026-04-01 00:00:00+00',
  TIMESTAMPTZ '2026-04-30 23:59:59+00',
  TIMESTAMPTZ '2026-05-01 00:00:00+00',
  TIMESTAMPTZ '2026-12-01 23:59:59+00',
  4,
  3
FROM events.event e
JOIN events.tenant t ON t.id = e.tenant_id AND t.slug = 'demo-org'
WHERE e.name = 'Evento Demo MVP'
  AND NOT EXISTS (
    SELECT 1 FROM events.event_configuration c WHERE c.event_id = e.id
  );

INSERT INTO events.event_layout_binding (event_id, layout_id, layout_version)
SELECT e.id, l.id, 1
FROM events.event e
JOIN events.tenant t ON t.id = e.tenant_id AND t.slug = 'demo-org'
JOIN events.venue v ON v.id = e.venue_id AND v.name = 'Salón Demo'
JOIN events.layout l ON l.venue_id = v.id AND l.name = 'Layout Demo'
WHERE e.name = 'Evento Demo MVP'
  AND NOT EXISTS (
    SELECT 1 FROM events.event_layout_binding b
    WHERE b.event_id = e.id AND b.layout_id = l.id
  );

INSERT INTO events.event_policy_document (
  event_id, document_type, version_label, title, content_markdown, status, published_at, created_by_user_id
)
SELECT e.id, vdoc.document_type, vdoc.version_label, vdoc.title, vdoc.content_markdown, 'PUBLISHED', now(), u.id
FROM events.event e
JOIN events.tenant t ON t.id = e.tenant_id AND t.slug = 'demo-org'
JOIN events.staff_user u ON u.email = 'admin@demo.local'
CROSS JOIN (
  VALUES
    ('DATA_POLICY'::varchar(32), 'v1.0'::varchar(64), 'Política de datos'::varchar(300), '# Política demo'::text),
    ('EVENT_TERMS'::varchar(32), 'v1.0'::varchar(64), 'Términos del evento'::varchar(300), '# Términos demo'::text)
) AS vdoc(document_type, version_label, title, content_markdown)
WHERE e.name = 'Evento Demo MVP'
  AND NOT EXISTS (
    SELECT 1 FROM events.event_policy_document d
    WHERE d.event_id = e.id
      AND d.document_type = vdoc.document_type
      AND d.version_label = vdoc.version_label
  );

INSERT INTO events.event_organizer_assignment (event_id, user_id, role)
SELECT e.id, u.id, 'EVENT_ADMIN'
FROM events.event e
JOIN events.tenant t ON t.id = e.tenant_id AND t.slug = 'demo-org'
JOIN events.staff_user u ON u.email = 'admin@demo.local'
WHERE e.name = 'Evento Demo MVP'
  AND NOT EXISTS (
    SELECT 1 FROM events.event_organizer_assignment a
    WHERE a.event_id = e.id AND a.user_id = u.id
  );
