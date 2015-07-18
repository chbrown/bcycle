CREATE TABLE program (
  id SERIAL PRIMARY KEY,
  -- B-cycle identifier "ProgramId"
  bcycle_program_id INTEGER UNIQUE NOT NULL,
  -- B-cycle program descriptor "Name" (usually ends with "B-cycle")
  name TEXT NOT NULL,
  -- "MapCenter" coordinates
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,

  -- additional information, like the web interface URL
  url TEXT,

  created TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp NOT NULL
);

CREATE TABLE kiosk (
  id SERIAL PRIMARY KEY,
  program_id INTEGER REFERENCES program(id) ON DELETE CASCADE NOT NULL,
  -- B-cycle identifier "Id"
  bcycle_id INTEGER UNIQUE NOT NULL,
  -- B-cycle string "Name"
  name TEXT NOT NULL,
  -- B-cycle string "PublicText"
  description TEXT NOT NULL,
  -- B-cycle "Address" fields
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT, -- NULL for other contries
  zip_code TEXT NOT NULL,
  country TEXT NOT NULL, -- "United States" even in other countries (WTF?)
  -- B-cycle "Location" fields
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  -- other non-changing (?) B-cycle fields
  time_zone TEXT NOT NULL,
  status TEXT NOT NULL,
  is_event_based BOOLEAN NOT NULL,

  created TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp NOT NULL
);

CREATE TABLE status (
  id SERIAL PRIMARY KEY,
  kiosk_id INTEGER REFERENCES kiosk(id) ON DELETE CASCADE NOT NULL,
  -- B-cycle status information attached to the kiosk
  docks_available INTEGER NOT NULL,
  bikes_available INTEGER NOT NULL,
  fetched TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp NOT NULL
);

CREATE VIEW program_last_fetched AS
  SELECT program.*, last_fetched FROM program
    LEFT OUTER JOIN (SELECT program_id, MAX(fetched) AS last_fetched FROM kiosk
      INNER JOIN status ON status.kiosk_id = kiosk.id
      GROUP BY program_id) AS kiosk_last_fetched ON kiosk_last_fetched.program_id = program.id;
