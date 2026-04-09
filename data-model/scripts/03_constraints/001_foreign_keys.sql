-- Claves foráneas (idempotentes). Ejecutar después de 02_tables.

DO $$
BEGIN
  ALTER TABLE events.venue
    ADD CONSTRAINT fk_venue_tenant FOREIGN KEY (tenant_id) REFERENCES events.tenant (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.layout
    ADD CONSTRAINT fk_layout_venue FOREIGN KEY (venue_id) REFERENCES events.venue (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.zone
    ADD CONSTRAINT fk_zone_layout FOREIGN KEY (layout_id) REFERENCES events.layout (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.fixed_feature
    ADD CONSTRAINT fk_fixed_feature_layout FOREIGN KEY (layout_id) REFERENCES events.layout (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.layout_table
    ADD CONSTRAINT fk_layout_table_layout FOREIGN KEY (layout_id) REFERENCES events.layout (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.layout_table
    ADD CONSTRAINT fk_layout_table_zone FOREIGN KEY (zone_id) REFERENCES events.zone (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event
    ADD CONSTRAINT fk_event_tenant FOREIGN KEY (tenant_id) REFERENCES events.tenant (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event
    ADD CONSTRAINT fk_event_venue FOREIGN KEY (venue_id) REFERENCES events.venue (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_configuration
    ADD CONSTRAINT fk_event_configuration_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_layout_binding
    ADD CONSTRAINT fk_event_layout_binding_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_layout_binding
    ADD CONSTRAINT fk_event_layout_binding_layout FOREIGN KEY (layout_id) REFERENCES events.layout (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_policy_document
    ADD CONSTRAINT fk_event_policy_document_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_policy_document
    ADD CONSTRAINT fk_event_policy_document_creator FOREIGN KEY (created_by_user_id) REFERENCES events.staff_user (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.user_tenant_membership
    ADD CONSTRAINT fk_utm_tenant FOREIGN KEY (tenant_id) REFERENCES events.tenant (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.user_tenant_membership
    ADD CONSTRAINT fk_utm_user FOREIGN KEY (user_id) REFERENCES events.staff_user (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_organizer_assignment
    ADD CONSTRAINT fk_eoa_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_organizer_assignment
    ADD CONSTRAINT fk_eoa_user FOREIGN KEY (user_id) REFERENCES events.staff_user (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.student_import_batch
    ADD CONSTRAINT fk_sib_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.student_import_batch
    ADD CONSTRAINT fk_sib_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES events.staff_user (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.student_record
    ADD CONSTRAINT fk_sr_batch FOREIGN KEY (import_batch_id) REFERENCES events.student_import_batch (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.student_record
    ADD CONSTRAINT fk_sr_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.attendee_group
    ADD CONSTRAINT fk_ag_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.attendee_group
    ADD CONSTRAINT fk_ag_student_record FOREIGN KEY (student_record_id) REFERENCES events.student_record (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.participant
    ADD CONSTRAINT fk_participant_group FOREIGN KEY (attendee_group_id) REFERENCES events.attendee_group (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment
    ADD CONSTRAINT fk_payment_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment
    ADD CONSTRAINT fk_payment_group FOREIGN KEY (attendee_group_id) REFERENCES events.attendee_group (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment
    ADD CONSTRAINT fk_payment_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES events.staff_user (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment_evidence
    ADD CONSTRAINT fk_pe_payment FOREIGN KEY (payment_id) REFERENCES events.payment (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Circular: attendee_group.current_payment_id -> payment (después de crear payment y sus FK hacia group)
DO $$
BEGIN
  ALTER TABLE events.attendee_group
    ADD CONSTRAINT fk_ag_current_payment FOREIGN KEY (current_payment_id) REFERENCES events.payment (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation
    ADD CONSTRAINT fk_res_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation
    ADD CONSTRAINT fk_res_group FOREIGN KEY (attendee_group_id) REFERENCES events.attendee_group (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation
    ADD CONSTRAINT fk_res_payment FOREIGN KEY (payment_id) REFERENCES events.payment (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.table_reservation
    ADD CONSTRAINT fk_tr_reservation FOREIGN KEY (reservation_id) REFERENCES events.reservation (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.table_reservation
    ADD CONSTRAINT fk_tr_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.table_reservation
    ADD CONSTRAINT fk_tr_group FOREIGN KEY (attendee_group_id) REFERENCES events.attendee_group (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.table_reservation
    ADD CONSTRAINT fk_tr_layout_table FOREIGN KEY (layout_table_id) REFERENCES events.layout_table (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.table_reservation
    ADD CONSTRAINT fk_tr_payment FOREIGN KEY (payment_id) REFERENCES events.payment (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_code_assignment
    ADD CONSTRAINT fk_rca_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_code_assignment
    ADD CONSTRAINT fk_rca_reservation FOREIGN KEY (reservation_id) REFERENCES events.reservation (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_code_assignment
    ADD CONSTRAINT fk_rca_participant FOREIGN KEY (participant_id) REFERENCES events.participant (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_consent
    ADD CONSTRAINT fk_rc_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_consent
    ADD CONSTRAINT fk_rc_reservation FOREIGN KEY (reservation_id) REFERENCES events.reservation (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_consent
    ADD CONSTRAINT fk_rc_group FOREIGN KEY (attendee_group_id) REFERENCES events.attendee_group (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_consent
    ADD CONSTRAINT fk_rc_policy_doc FOREIGN KEY (policy_document_id) REFERENCES events.event_policy_document (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_consent
    ADD CONSTRAINT fk_rc_terms_doc FOREIGN KEY (terms_document_id) REFERENCES events.event_policy_document (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_consent
    ADD CONSTRAINT fk_rc_accepted_by_user FOREIGN KEY (accepted_by_user_id) REFERENCES events.staff_user (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.audit_log
    ADD CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES events.tenant (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.audit_log
    ADD CONSTRAINT fk_audit_event FOREIGN KEY (event_id) REFERENCES events.event (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.audit_log
    ADD CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES events.staff_user (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
