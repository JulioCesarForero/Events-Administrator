CREATE OR REPLACE VIEW events.v_table_availability_by_event AS
SELECT
    e.id AS event_id,
    lt.id AS layout_table_id,
    lt.code AS table_code,
    lt.table_capacity_limit,
    lt.current_occupied_spots AS stored_occupied_spots,
    COALESCE(SUM(tr.spots_reserved) FILTER (WHERE tr.status = 'ACTIVE'), 0)::integer AS computed_active_spots,
    (lt.table_capacity_limit - COALESCE(SUM(tr.spots_reserved) FILTER (WHERE tr.status = 'ACTIVE'), 0))::integer AS available_spots_computed
FROM events.event e
JOIN events.event_layout_binding elb ON elb.event_id = e.id
JOIN events.layout_table lt ON lt.layout_id = elb.layout_id
LEFT JOIN events.table_reservation tr ON tr.layout_table_id = lt.id AND tr.event_id = e.id
GROUP BY e.id, lt.id, lt.code, lt.table_capacity_limit, lt.current_occupied_spots;

COMMENT ON VIEW events.v_table_availability_by_event IS 'Disponibilidad agregada por mesa y evento (suma de table_reservation ACTIVE vs capacidad)';

CREATE OR REPLACE VIEW events.v_group_payment_status AS
SELECT
    g.id AS attendee_group_id,
    g.event_id,
    g.student_code_snapshot,
    p.id AS payment_id,
    p.status AS payment_status,
    p.ticket_quantity,
    p.approved_at,
    p.rejected_at,
    p.submitted_at
FROM events.attendee_group g
LEFT JOIN LATERAL (
    SELECT p.*
    FROM events.payment p
    WHERE p.attendee_group_id = g.id
    ORDER BY p.created_at DESC
    LIMIT 1
) p ON true;

COMMENT ON VIEW events.v_group_payment_status IS 'Último pago conocido por grupo comprador (ordenado por created_at)';

CREATE OR REPLACE VIEW events.v_event_reservation_summary AS
SELECT
    e.id AS event_id,
    COUNT(r.id) AS reservation_count,
    COALESCE(SUM(r.total_spots_reserved) FILTER (WHERE r.status = 'CONFIRMED'), 0)::bigint AS total_spots_confirmed
FROM events.event e
LEFT JOIN events.reservation r ON r.event_id = e.id
GROUP BY e.id;

COMMENT ON VIEW events.v_event_reservation_summary IS 'Resumen de reservas por evento';

CREATE OR REPLACE VIEW events.v_participant_reservation_codes AS
SELECT
    p.id AS participant_id,
    p.attendee_group_id,
    rca.event_id,
    rca.reservation_id,
    rca.reservation_code,
    rca.code_sequence_number
FROM events.participant p
JOIN events.reservation_code_assignment rca ON rca.participant_id = p.id;

COMMENT ON VIEW events.v_participant_reservation_codes IS 'Participante con su código correlativo de reserva';

CREATE OR REPLACE VIEW events.v_event_current_policies AS
SELECT DISTINCT ON (event_id, document_type)
    event_id,
    document_type,
    id AS document_id,
    version_label,
    title,
    published_at,
    status
FROM events.event_policy_document
WHERE status = 'PUBLISHED'
ORDER BY event_id, document_type, published_at DESC NULLS LAST, id;

COMMENT ON VIEW events.v_event_current_policies IS 'Documento legal publicado vigente por tipo y evento (última publicación)';
