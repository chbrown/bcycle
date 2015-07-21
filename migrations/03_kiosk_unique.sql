ALTER TABLE kiosk DROP CONSTRAINT kiosk_bcycle_id_key;

ALTER TABLE kiosk ADD CONSTRAINT kiosk_program_id_bcycle_id_key UNIQUE (program_id, bcycle_id);
