-- Site Leader Matrix schema (Neon / Postgres)

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  site_name TEXT NOT NULL UNIQUE,
  site_topic TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('fan_authority','editorial_instincts','ownership','leadership')),
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 10),
  note TEXT NOT NULL DEFAULT '',
  is_canonized BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  UNIQUE(site_id, category)
);

CREATE TABLE IF NOT EXISTS score_history (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  score NUMERIC NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL CHECK (event_type IN ('canonized','update')),
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS division_notes (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS leader_changes (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  old_leader TEXT NOT NULL,
  new_leader TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- seed exactly one division_notes row
INSERT INTO division_notes (id, content) VALUES (1, '')
ON CONFLICT (id) DO NOTHING;
