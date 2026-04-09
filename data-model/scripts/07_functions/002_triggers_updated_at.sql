DROP TRIGGER IF EXISTS trg_tenant_updated_at ON events.tenant;
CREATE TRIGGER trg_tenant_updated_at
BEFORE UPDATE ON events.tenant
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_venue_updated_at ON events.venue;
CREATE TRIGGER trg_venue_updated_at
BEFORE UPDATE ON events.venue
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_layout_updated_at ON events.layout;
CREATE TRIGGER trg_layout_updated_at
BEFORE UPDATE ON events.layout
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_layout_table_updated_at ON events.layout_table;
CREATE TRIGGER trg_layout_table_updated_at
BEFORE UPDATE ON events.layout_table
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_event_updated_at ON events.event;
CREATE TRIGGER trg_event_updated_at
BEFORE UPDATE ON events.event
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_event_configuration_updated_at ON events.event_configuration;
CREATE TRIGGER trg_event_configuration_updated_at
BEFORE UPDATE ON events.event_configuration
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_event_policy_document_updated_at ON events.event_policy_document;
CREATE TRIGGER trg_event_policy_document_updated_at
BEFORE UPDATE ON events.event_policy_document
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_attendee_group_updated_at ON events.attendee_group;
CREATE TRIGGER trg_attendee_group_updated_at
BEFORE UPDATE ON events.attendee_group
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_participant_updated_at ON events.participant;
CREATE TRIGGER trg_participant_updated_at
BEFORE UPDATE ON events.participant
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_updated_at ON events.payment;
CREATE TRIGGER trg_payment_updated_at
BEFORE UPDATE ON events.payment
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_reservation_updated_at ON events.reservation;
CREATE TRIGGER trg_reservation_updated_at
BEFORE UPDATE ON events.reservation
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();

DROP TRIGGER IF EXISTS trg_table_reservation_updated_at ON events.table_reservation;
CREATE TRIGGER trg_table_reservation_updated_at
BEFORE UPDATE ON events.table_reservation
FOR EACH ROW
EXECUTE PROCEDURE events.set_updated_at();
