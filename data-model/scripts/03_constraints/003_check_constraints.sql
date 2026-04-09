DO $$
BEGIN
  ALTER TABLE events.tenant ADD CONSTRAINT ck_tenant_status
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.staff_user ADD CONSTRAINT ck_staff_user_status
    CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.layout ADD CONSTRAINT ck_layout_status
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event ADD CONSTRAINT ck_event_status
    CHECK (status IN ('DRAFT', 'PREPARING', 'OPEN', 'CLOSED', 'ARCHIVED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_policy_document ADD CONSTRAINT ck_policy_doc_status
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_policy_document ADD CONSTRAINT ck_policy_doc_type
    CHECK (document_type IN ('DATA_POLICY', 'EVENT_TERMS'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.student_import_batch ADD CONSTRAINT ck_sib_status
    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.attendee_group ADD CONSTRAINT ck_ag_reservation_status
    CHECK (reservation_status IN ('NONE', 'PENDING', 'CONFIRMED', 'RELEASED', 'ADJUSTED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment ADD CONSTRAINT ck_payment_type
    CHECK (payment_type IN ('DIGITAL', 'CASH'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment ADD CONSTRAINT ck_payment_status
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment ADD CONSTRAINT ck_payment_ticket_qty
    CHECK (ticket_quantity > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment ADD CONSTRAINT ck_payment_approved_at
    CHECK (status <> 'APPROVED' OR approved_at IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment ADD CONSTRAINT ck_payment_rejected_at
    CHECK (status <> 'REJECTED' OR rejected_at IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.layout_table ADD CONSTRAINT ck_layout_table_capacity
    CHECK (table_capacity_limit > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.layout_table ADD CONSTRAINT ck_layout_table_occupied
    CHECK (current_occupied_spots >= 0 AND current_occupied_spots <= table_capacity_limit);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.table_reservation ADD CONSTRAINT ck_tr_spots
    CHECK (spots_reserved > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.table_reservation ADD CONSTRAINT ck_tr_status
    CHECK (status IN ('ACTIVE', 'RELEASED', 'MOVED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation ADD CONSTRAINT ck_reservation_status
    CHECK (status IN ('CONFIRMED', 'RELEASED', 'ADJUSTED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation ADD CONSTRAINT ck_reservation_total_spots
    CHECK (total_spots_reserved > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.reservation_code_assignment ADD CONSTRAINT ck_rca_seq_positive
    CHECK (code_sequence_number > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_configuration ADD CONSTRAINT ck_event_config_presale
    CHECK (presale_start_date < presale_end_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_configuration ADD CONSTRAINT ck_event_config_sale
    CHECK (sale_start_date < sale_end_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.event_configuration ADD CONSTRAINT ck_event_config_max_tickets
    CHECK (max_presale_tickets > 0 AND max_sale_tickets > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment_evidence ADD CONSTRAINT ck_pe_evidence_type
    CHECK (evidence_type IN ('DIGITAL_PROOF', 'CASH_RECEIPT_PHOTO', 'OTHER'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE events.payment_evidence ADD CONSTRAINT ck_pe_uploaded_by
    CHECK (uploaded_by_actor_type IN ('BUYER', 'STAFF', 'SYSTEM'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
