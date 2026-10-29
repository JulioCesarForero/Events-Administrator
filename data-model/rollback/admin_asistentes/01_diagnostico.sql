-- Rollback "admin: reemplazar/eliminar asistentes" — PASO 1: diagnóstico (solo lectura).
-- Ejecutar ANTES de decidir el rollback. No modifica datos.

-- 1. ¿La migración 004 está aplicada? (YES = participant_id admite NULL)
SELECT is_nullable AS participant_id_nullable
FROM information_schema.columns
WHERE table_schema = 'events'
  AND table_name = 'reservation_code_assignment'
  AND column_name = 'participant_id';

-- 2. Códigos vacantes (los que la versión estable NO sabe manejar).
SELECT g.student_code_snapshot, rca.reservation_code, r.status AS reservation_status, rca.event_id
FROM events.reservation_code_assignment rca
JOIN events.reservation r ON r.id = rca.reservation_id
JOIN events.attendee_group g ON g.id = r.attendee_group_id
WHERE rca.participant_id IS NULL
ORDER BY g.student_code_snapshot, rca.code_sequence_number;

-- 3. Actividad de la nueva versión (eliminaciones / reemplazos / altas con código heredado).
SELECT a.occurred_at, a.action,
       a.payload_json ->> 'attendeeGroupId' AS group_id,
       COALESCE(a.payload_json ->> 'vacatedReservationCode',
                a.payload_json ->> 'assignedReservationCode') AS reservation_code,
       a.payload_json ->> 'reason' AS reason
FROM events.audit_log a
WHERE a.action IN ('STAFF_DELETE_PARTICIPANT', 'STAFF_REPLACE_PARTICIPANT')
   OR (a.action = 'STAFF_CREATE_PARTICIPANT' AND a.payload_json ->> 'assignedReservationCode' IS NOT NULL)
ORDER BY a.occurred_at;
