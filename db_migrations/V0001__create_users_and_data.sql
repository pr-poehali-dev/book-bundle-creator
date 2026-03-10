CREATE TABLE IF NOT EXISTS t_p56529697_book_bundle_creator.users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p56529697_book_bundle_creator.user_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p56529697_book_bundle_creator.users(id),
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
