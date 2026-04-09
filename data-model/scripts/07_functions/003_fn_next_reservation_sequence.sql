CREATE OR REPLACE FUNCTION events.fn_next_reservation_sequence_number(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_next INTEGER;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('events:reservation_seq:' || p_event_id::text));

    SELECT COALESCE(MAX(code_sequence_number), 0) + 1
    INTO v_next
    FROM events.reservation_code_assignment
    WHERE event_id = p_event_id;

    RETURN v_next;
END;
$$;

COMMENT ON FUNCTION events.fn_next_reservation_sequence_number(UUID) IS 'Siguiente número correlativo por evento; usar dentro de transacción con bloqueo consultivo';
