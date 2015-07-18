CREATE TABLE station (
  id SERIAL PRIMARY KEY,

  title TEXT NOT NULL,
  description TEXT NOT NULL,
  address TEXT NOT NULL,

  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,

  has_trikes BOOLEAN,

  created TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp NOT NULL
);

CREATE TABLE status (
  id SERIAL PRIMARY KEY,
  station_id INTEGER REFERENCES station(id) ON DELETE CASCADE NOT NULL,

  docks INTEGER NOT NULL,
  bikes INTEGER NOT NULL,
  icon TEXT NOT NULL,
  back TEXT NOT NULL,

  accessed TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp NOT NULL
);
