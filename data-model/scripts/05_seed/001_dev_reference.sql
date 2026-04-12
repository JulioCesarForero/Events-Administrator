-- Datos mínimos para desarrollo local (idempotente).

INSERT INTO events.tenant (name, slug, status)
SELECT 'Organización Demo', 'demo-org', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM events.tenant WHERE slug = 'demo-org');

-- password: Admin123!  (bcrypt hash, safe for dev seed only)
INSERT INTO events.staff_user (email, display_name, password_hash, status)
SELECT 'admin@demo.local', 'Administrador Demo',
       '$2b$12$oHh7zf6XFTYTFjxNCCbJ2.VJzWhr.VR80BaxbSG7dEQaLPD2esrWS', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM events.staff_user WHERE email = 'admin@demo.local');

INSERT INTO events.user_tenant_membership (tenant_id, user_id, role)
SELECT t.id, u.id, 'ORG_ADMIN'
FROM events.tenant t
JOIN events.staff_user u ON u.email = 'admin@demo.local'
WHERE t.slug = 'demo-org'
  AND NOT EXISTS (
    SELECT 1 FROM events.user_tenant_membership m
    WHERE m.tenant_id = t.id AND m.user_id = u.id
  );
