ALTER TABLE program
  ADD COLUMN last_fetched TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT '1970-01-01';

DROP VIEW program_last_fetched;