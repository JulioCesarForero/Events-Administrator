-- Rollback "admin: reemplazar/eliminar asistentes" — PASO 2: restaurar asistentes eliminados.
-- Recrea, desde la auditoría STAFF_DELETE_PARTICIPANT, a los asistentes que el staff eliminó
-- después de la fecha del despliegue y les devuelve su código si sigue vacante.
-- Idempotente: no duplica asistentes ya restaurados ni toca códigos ya ocupados.
--
-- ANTES DE EJECUTAR: reemplaza la fecha de 'since' por el momento del despliegue (hora Colombia).

BEGIN;

WITH params AS (
  SELECT timestamptz '2026-10-29 00:00:00-05' AS since
),
deleted AS (
  SELECT DISTINCT ON (a.entity_id)
         a.event_id,
         a.payload_json -> 'participant' AS p,
         a.payload_json ->> 'vacatedReservationCode' AS code
  FROM events.audit_log a, params
  WHERE a.action = 'STAFF_DELETE_PARTICIPANT'
    AND a.occurred_at >= params.since
  ORDER BY a.entity_id, a.occurred_at DESC
),
restored AS (
  INSERT INTO events.participant (
    id, attendee_group_id, first_name, last_name, document_type, document_id,
    is_vegetarian, allergies, mobile_phone, emergency_contact_name,
    emergency_contact_phone, has_reduced_mobility
  )
  SELECT (d.p ->> 'id')::uuid, (d.p ->> 'attendee_group_id')::uuid,
         d.p ->> 'first_name', d.p ->> 'last_name', d.p ->> 'document_type', d.p ->> 'document_id',
         (d.p ->> 'is_vegetarian')::boolean, COALESCE(d.p ->> 'allergies', ''), d.p ->> 'mobile_phone',
         d.p ->> 'emergency_contact_name', d.p ->> 'emergency_contact_phone',
         (d.p ->> 'has_reduced_mobility')::boolean
  FROM deleted d
  WHERE EXISTS (SELECT 1 FROM events.attendee_group g WHERE g.id = (d.p ->> 'attendee_group_id')::uuid)
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
UPDATE events.reservation_code_assignment rca
SET participant_id = (d.p ->> 'id')::uuid
FROM deleted d
WHERE rca.event_id = d.event_id
  AND rca.reservation_code = d.code
  AND rca.participant_id IS NULL
  AND (EXISTS (SELECT 1 FROM restored r WHERE r.id = (d.p ->> 'id')::uuid)
       OR EXISTS (SELECT 1 FROM events.participant x WHERE x.id = (d.p ->> 'id')::uuid));

-- Verificación: debe devolver 0 filas para poder hacer rollback de la columna (paso 3).
SELECT rca.reservation_code, rca.event_id
FROM events.reservation_code_assignment rca
WHERE rca.participant_id IS NULL;

-- Si el resultado es el esperado: COMMIT;   si no: ROLLBACK;
