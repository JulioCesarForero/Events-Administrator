CREATE INDEX IF NOT EXISTS idx_venue_tenant ON events.venue (tenant_id);
CREATE INDEX IF NOT EXISTS idx_layout_venue ON events.layout (venue_id);
CREATE INDEX IF NOT EXISTS idx_zone_layout ON events.zone (layout_id);
CREATE INDEX IF NOT EXISTS idx_fixed_feature_layout ON events.fixed_feature (layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_table_layout ON events.layout_table (layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_table_zone ON events.layout_table (zone_id);

CREATE INDEX IF NOT EXISTS idx_event_tenant ON events.event (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_venue ON events.event (venue_id);
CREATE INDEX IF NOT EXISTS idx_event_status ON events.event (status);

CREATE INDEX IF NOT EXISTS idx_event_layout_binding_event ON events.event_layout_binding (event_id);
CREATE INDEX IF NOT EXISTS idx_event_layout_binding_layout ON events.event_layout_binding (layout_id);

CREATE INDEX IF NOT EXISTS idx_policy_doc_event ON events.event_policy_document (event_id);
CREATE INDEX IF NOT EXISTS idx_policy_doc_event_type_status ON events.event_policy_document (event_id, document_type, status);

CREATE INDEX IF NOT EXISTS idx_sib_event ON events.student_import_batch (event_id);
CREATE INDEX IF NOT EXISTS idx_sr_event ON events.student_record (event_id);
CREATE INDEX IF NOT EXISTS idx_sr_student_code ON events.student_record (event_id, student_code);

CREATE INDEX IF NOT EXISTS idx_ag_event ON events.attendee_group (event_id);
CREATE INDEX IF NOT EXISTS idx_participant_group ON events.participant (attendee_group_id);

CREATE INDEX IF NOT EXISTS idx_payment_event ON events.payment (event_id);
CREATE INDEX IF NOT EXISTS idx_payment_group ON events.payment (attendee_group_id);
CREATE INDEX IF NOT EXISTS idx_payment_event_status ON events.payment (event_id, status);

CREATE INDEX IF NOT EXISTS idx_pe_payment ON events.payment_evidence (payment_id);

CREATE INDEX IF NOT EXISTS idx_reservation_event ON events.reservation (event_id);
CREATE INDEX IF NOT EXISTS idx_reservation_group ON events.reservation (attendee_group_id);
CREATE INDEX IF NOT EXISTS idx_reservation_payment ON events.reservation (payment_id);

CREATE INDEX IF NOT EXISTS idx_tr_reservation ON events.table_reservation (reservation_id);
CREATE INDEX IF NOT EXISTS idx_tr_layout_table ON events.table_reservation (layout_table_id);
CREATE INDEX IF NOT EXISTS idx_tr_event_table ON events.table_reservation (event_id, layout_table_id);

CREATE INDEX IF NOT EXISTS idx_tr_active_by_table
  ON events.table_reservation (layout_table_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_rca_event_reservation ON events.reservation_code_assignment (event_id, reservation_id);
CREATE INDEX IF NOT EXISTS idx_rca_participant ON events.reservation_code_assignment (participant_id);

CREATE INDEX IF NOT EXISTS idx_rc_reservation ON events.reservation_consent (reservation_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_time ON events.audit_log (event_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON events.audit_log (entity_type, entity_id);
