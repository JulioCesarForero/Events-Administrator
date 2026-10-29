-- A reservation code can stay vacant (participant_id NULL) when staff removes its participant;
-- the code and its table spot remain with the group and go to the next participant added.
-- fk_rca_participant keeps ON DELETE RESTRICT: the backend clears participant_id explicitly.
ALTER TABLE events.reservation_code_assignment ALTER COLUMN participant_id DROP NOT NULL;
