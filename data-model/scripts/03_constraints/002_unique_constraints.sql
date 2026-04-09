DO $$
BEGIN
  ALTER TABLE events.tenant ADD CONSTRAINT uq_tenant_slug UNIQUE (slug);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.staff_user ADD CONSTRAINT uq_staff_user_email UNIQUE (email);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.user_tenant_membership ADD CONSTRAINT uq_utm_tenant_user UNIQUE (tenant_id, user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_organizer_assignment ADD CONSTRAINT uq_eoa_event_user UNIQUE (event_id, user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.student_record ADD CONSTRAINT uq_student_record_event_code UNIQUE (event_id, student_code);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.layout_table ADD CONSTRAINT uq_layout_table_layout_code UNIQUE (layout_id, code);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_policy_document ADD CONSTRAINT uq_policy_event_type_version UNIQUE (event_id, document_type, version_label);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_configuration ADD CONSTRAINT uq_event_configuration_event UNIQUE (event_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.attendee_group ADD CONSTRAINT uq_attendee_group_event_student_record UNIQUE (event_id, student_record_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.attendee_group ADD CONSTRAINT uq_attendee_group_event_code_snapshot UNIQUE (event_id, student_code_snapshot);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_code_assignment ADD CONSTRAINT uq_rca_event_reservation_code UNIQUE (event_id, reservation_code);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_code_assignment ADD CONSTRAINT uq_rca_event_sequence UNIQUE (event_id, code_sequence_number);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_consent ADD CONSTRAINT uq_reservation_consent_reservation UNIQUE (reservation_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
