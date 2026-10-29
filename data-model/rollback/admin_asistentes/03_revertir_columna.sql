-- Rollback "admin: reemplazar/eliminar asistentes" — PASO 3 (OPCIONAL): revertir la migración 004.
-- Deja reservation_code_assignment.participant_id otra vez en NOT NULL.
-- Solo es necesario si se quiere el esquema exacto de la versión estable: la versión estable
-- funciona igual con la columna en NULL siempre que no existan códigos vacantes.
-- Falla de forma segura (no cambia nada) si todavía hay códigos vacantes: ejecutar antes el paso 2.

DO $$
DECLARE
  vacantes integer;
BEGIN
  SELECT count(*) INTO vacantes
  FROM events.reservation_code_assignment
  WHERE participant_id IS NULL;

  IF vacantes > 0 THEN
    RAISE EXCEPTION 'Hay % código(s) vacante(s). Ejecuta 02_restaurar_eliminados.sql primero.', vacantes;
  END IF;

  ALTER TABLE events.reservation_code_assignment ALTER COLUMN participant_id SET NOT NULL;
END $$;
