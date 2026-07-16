// Canonical schema definition — single source of truth.
// Used by scripts/seed.ts (local) AND app/api/admin/migrate (in-app, runs
// against whatever DATABASE_URL Vercel already has configured server-side —
// no need to pull secrets locally just to apply a schema change).
// schema.sql is kept as a human-readable mirror of this file.

export const SCHEMA_SQL = `
-- Site Leader Matrix schema (Neon / Postgres)

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  site_name TEXT NOT NULL UNIQUE,
  site_topic TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  division TEXT NOT NULL DEFAULT 'NFL',
  excluded_from_aggregation BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE sites ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'NFL';
CREATE INDEX IF NOT EXISTS idx_sites_division ON sites(division);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS excluded_from_aggregation BOOLEAN NOT NULL DEFAULT FALSE;

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

-- Site Depth Charts (shares the sites table above with Site Leader Matrix)

CREATE TABLE IF NOT EXISTS depth_chart_roles (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL DEFAULT 'contributors',
  sort_order INT NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS depth_chart_writers (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  traffic_dashboard_name TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO depth_chart_roles (label, sort_order) VALUES
  ('Site Editor', 1),
  ('Site Expert', 2),
  ('Staff Writer', 3),
  ('Contributor', 4),
  ('Copy Specialist', 5),
  ('Site No. 2', 6),
  ('Rover', 7)
ON CONFLICT (label) DO NOTHING;

ALTER TABLE depth_chart_roles ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'contributors';

UPDATE depth_chart_roles SET section = 'site_leaders' WHERE label IN ('Site Editor', 'Site Expert', 'Site No. 2');
UPDATE depth_chart_roles SET section = 'specialists' WHERE label = 'Copy Specialist';
UPDATE depth_chart_roles SET section = 'contributors' WHERE label = 'Contributor';
UPDATE depth_chart_roles SET section = 'division_resources' WHERE label IN ('Staff Writer', 'Rover');

-- Traffic data ingestion (shared across tools, currently surfaced in Site Depth Charts)

ALTER TABLE sites ADD COLUMN IF NOT EXISTS hostname TEXT;

CREATE TABLE IF NOT EXISTS traffic_imports (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  imported_by TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, period_key)
);

CREATE TABLE IF NOT EXISTS article_traffic (
  id SERIAL PRIMARY KEY,
  import_id INT NOT NULL REFERENCES traffic_imports(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  article_title TEXT NOT NULL,
  article_author TEXT,
  article_url TEXT,
  first_published_date DATE,
  pageviews INT NOT NULL DEFAULT 0,
  scroll_depth NUMERIC,
  avg_time_on_page NUMERIC
);

ALTER TABLE article_traffic ADD COLUMN IF NOT EXISTS article_url TEXT;

CREATE INDEX IF NOT EXISTS idx_article_traffic_import ON article_traffic(import_id);
CREATE INDEX IF NOT EXISTS idx_article_traffic_site_pageviews ON article_traffic(site_id, pageviews DESC);
CREATE INDEX IF NOT EXISTS idx_article_traffic_site_author ON article_traffic(site_id, article_author);

CREATE TABLE IF NOT EXISTS writer_notes (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES depth_chart_writers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writer_notes_writer ON writer_notes(writer_id);

CREATE TABLE IF NOT EXISTS ignored_traffic_authors (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, author_name)
);

CREATE TABLE IF NOT EXISTS writer_aliases (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES depth_chart_writers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(writer_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_writer_aliases_writer ON writer_aliases(writer_id);

-- Space-saving archive: once a month's raw article_traffic rows are pruned
-- (see /api/admin/archive-old-traffic), the site- and writer-level totals
-- for that period live here instead, so trend charts keep working without
-- needing every individual article kept around forever.

ALTER TABLE traffic_imports ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS site_traffic_archive (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  articles_published INT NOT NULL DEFAULT 0,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  evergreen_pageviews BIGINT NOT NULL DEFAULT 0,
  homepage_pageviews BIGINT NOT NULL DEFAULT 0,
  weighted_avg_scroll_depth NUMERIC,
  weighted_avg_time_on_page NUMERIC,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, period_key)
);

CREATE TABLE IF NOT EXISTS writer_traffic_archive (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES depth_chart_writers(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  articles_published INT NOT NULL DEFAULT 0,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  weighted_avg_scroll_depth NUMERIC,
  weighted_avg_time_on_page NUMERIC,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(writer_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_site_traffic_archive_site ON site_traffic_archive(site_id);
CREATE INDEX IF NOT EXISTS idx_writer_traffic_archive_writer ON writer_traffic_archive(writer_id);

-- Post-it style quick notes. Generic on purpose: subject_type/subject_id
-- identify ANY container in the app (a writer, a site, a division-home
-- card, the home page overall, ...), field_label optionally narrows it to
-- one specific stat/field within that container. Visible to everyone who
-- signs in — there's no per-user privacy model in this app.
CREATE TABLE IF NOT EXISTS sticky_notes (
  id SERIAL PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  field_label TEXT,
  color TEXT NOT NULL DEFAULT 'yellow',
  body TEXT NOT NULL,
  pos_x REAL,
  pos_y REAL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);

ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS pos_x REAL;
ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS pos_y REAL;
ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS deleted_by TEXT;

CREATE TABLE IF NOT EXISTS sticky_note_replies (
  id SERIAL PRIMARY KEY,
  note_id INT NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticky_note_replies_note ON sticky_note_replies(note_id);

CREATE TABLE IF NOT EXISTS sticky_note_mentions (
  id SERIAL PRIMARY KEY,
  note_id INT REFERENCES sticky_notes(id) ON DELETE CASCADE,
  reply_id INT REFERENCES sticky_note_replies(id) ON DELETE CASCADE,
  mentioned_name TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sticky_note_mentions_name ON sticky_note_mentions(mentioned_name);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_subject ON sticky_notes(subject_type, subject_id);

-- Post-it style notes. Fully generic: subject_type + subject_id identify
-- WHAT the note is about (a writer, a site, the home screen, a division —
-- anything), and field_label optionally narrows it to one specific field
-- within that subject (e.g. "Scroll Depth"). NULL field_label means the
-- note is about the subject as a whole.
CREATE TABLE IF NOT EXISTS sticky_notes (
  id SERIAL PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  field_label TEXT,
  content TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_subject ON sticky_notes(subject_type, subject_id);
`;
