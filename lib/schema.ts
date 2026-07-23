// Canonical schema definition — single source of truth.
// Used by scripts/seed.ts (local) AND app/api/admin/migrate (in-app, runs
// against whatever DATABASE_URL Vercel already has configured server-side —
// no need to pull secrets locally just to apply a schema change).
// schema.sql is kept as a human-readable mirror of this file.

export const SCHEMA_SQL = `
-- Site Leader Matrix schema (Neon / Postgres)

-- Mirrors lib/trafficStats.ts's normalizeArticleUrl()/articleKey() exactly —
-- used by routes that count/aggregate articles directly in SQL (COUNT(*)
-- style) rather than fetching rows and deduping in JS via dedupeArticles().
-- Falls back to article_title, then the row's own id (guaranteed unique),
-- so two different untitled/unURLed rows never get merged together.
-- Finds the path segment that's the real SEO article slug (the one with
-- the most hyphens — a true slug reads like a full sentence) and discards
-- everything after it, regardless of what junk a given CMS tacks on
-- there (a slideshow page number, a tracking segment like "partners/id",
-- /app, /amp, or anything else) — a general strategy rather than a list
-- of specific known suffixes to maintain.
CREATE OR REPLACE FUNCTION normalize_article_key(url TEXT, title TEXT, row_id INT)
RETURNS TEXT AS $$
DECLARE
  u TEXT;
  hostname TEXT;
  path_part TEXT;
  segments TEXT[];
  seg TEXT;
  best_index INT := -1;
  best_hyphens INT := 0;
  hyphens INT;
  i INT;
  kept TEXT;
BEGIN
  IF url IS NULL OR TRIM(url) = '' THEN
    RETURN COALESCE(title, 'row-' || row_id::text);
  END IF;
  u := TRIM(url);
  u := REGEXP_REPLACE(u, '^https?://', '', 'i');
  u := SPLIT_PART(u, '?', 1);
  u := SPLIT_PART(u, '#', 1);
  u := REGEXP_REPLACE(u, '/+$', '');
  IF u = '' THEN
    RETURN COALESCE(title, 'row-' || row_id::text);
  END IF;

  IF POSITION('/' IN u) = 0 THEN
    RETURN LOWER(u);
  END IF;

  hostname := SPLIT_PART(u, '/', 1);
  path_part := SUBSTRING(u FROM POSITION('/' IN u) + 1);
  segments := ARRAY(SELECT s FROM UNNEST(STRING_TO_ARRAY(path_part, '/')) AS s WHERE s <> '');

  IF segments IS NULL OR array_length(segments, 1) IS NULL THEN
    RETURN LOWER(hostname);
  END IF;

  FOR i IN 1 .. array_length(segments, 1) LOOP
    seg := segments[i];
    hyphens := LENGTH(seg) - LENGTH(REPLACE(seg, '-', ''));
    IF hyphens > best_hyphens THEN
      best_hyphens := hyphens;
      best_index := i;
    END IF;
  END LOOP;

  IF best_index = -1 THEN
    kept := ARRAY_TO_STRING(segments, '/');
  ELSE
    kept := ARRAY_TO_STRING(segments[1:best_index], '/');
  END IF;

  RETURN LOWER(hostname || '/' || kept);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

-- Captures site- and writer-level totals right before a re-upload replaces
-- them, so "current vs. previous upload" deltas are possible even though
-- the detailed article_traffic rows themselves get overwritten. Cheap to
-- keep every generation of these (a handful of numbers per site/writer per
-- upload), unlike keeping full raw article history.
CREATE TABLE IF NOT EXISTS site_traffic_snapshots (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  articles_published INT NOT NULL DEFAULT 0,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  published_pageviews BIGINT NOT NULL DEFAULT 0,
  evergreen_pageviews BIGINT NOT NULL DEFAULT 0,
  homepage_pageviews BIGINT NOT NULL DEFAULT 0,
  weighted_avg_scroll_depth NUMERIC,
  weighted_avg_time_on_page NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_site_traffic_snapshots_lookup
  ON site_traffic_snapshots(site_id, period_key, snapshot_at DESC);
ALTER TABLE site_traffic_snapshots ADD COLUMN IF NOT EXISTS published_pageviews BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS writer_traffic_snapshots (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES depth_chart_writers(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  articles_published INT NOT NULL DEFAULT 0,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  published_pageviews BIGINT NOT NULL DEFAULT 0,
  weighted_avg_scroll_depth NUMERIC,
  weighted_avg_time_on_page NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_writer_traffic_snapshots_lookup
  ON writer_traffic_snapshots(writer_id, period_key, snapshot_at DESC);

-- True day-over-day deltas: unlike the snapshots above (aggregate-only,
-- diffed after the fact), these are computed by matching every individual
-- article between the outgoing and incoming data at the moment of
-- upload — the only point where both states exist simultaneously. This
-- captures the real incremental scroll/time behavior across ALL of a
-- site's or writer's traffic (old evergreen articles included, not just
-- newly-published ones), which can't be reconstructed later from
-- aggregate-only snapshots. One row is written per upload that replaces
-- existing data.
CREATE TABLE IF NOT EXISTS site_daily_deltas (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pv_delta BIGINT NOT NULL DEFAULT 0,
  scroll_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0,
  time_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_site_daily_deltas_lookup
  ON site_daily_deltas(site_id, period_key, captured_at DESC);

CREATE TABLE IF NOT EXISTS writer_daily_deltas (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES depth_chart_writers(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pv_delta BIGINT NOT NULL DEFAULT 0,
  scroll_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0,
  time_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_writer_daily_deltas_lookup
  ON writer_daily_deltas(writer_id, period_key, captured_at DESC);
ALTER TABLE writer_traffic_snapshots ADD COLUMN IF NOT EXISTS published_pageviews BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sticky_notes_subject ON sticky_notes(subject_type, subject_id);

-- ============================================================
-- OnSI network — a second, fully separate product sharing this
-- codebase. No Site Leader Matrix / grading here (that's a
-- FanSided-only feature), so no scores/score_history/leader_changes
-- equivalents. Every other onsi_* table mirrors its FanSided
-- counterpart 1:1 so the same application code/patterns apply.
--
-- Sticky notes are deliberately NOT duplicated for OnSI — the
-- existing sticky_notes/sticky_note_replies/sticky_note_mentions
-- tables are already isolated by page URL path (subject_id is the
-- path), and every OnSI page lives under /onsi/*, so notes on an
-- OnSI page can never collide with a FanSided one.
-- ============================================================

CREATE TABLE IF NOT EXISTS onsi_sites (
  id SERIAL PRIMARY KEY,
  site_name TEXT NOT NULL UNIQUE,
  site_topic TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  division TEXT NOT NULL DEFAULT '',
  hostname TEXT,
  url_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_onsi_sites_division ON onsi_sites(division);
ALTER TABLE onsi_sites ADD COLUMN IF NOT EXISTS url_path TEXT;

CREATE TABLE IF NOT EXISTS onsi_depth_chart_roles (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL DEFAULT 'contributors',
  sort_order INT NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO onsi_depth_chart_roles (label, section, sort_order) VALUES
  ('Site Editor', 'site_leaders', 1),
  ('Site Expert', 'site_leaders', 2),
  ('Staff Writer', 'division_resources', 3),
  ('Contributor', 'contributors', 4),
  ('Copy Specialist', 'specialists', 5),
  ('Site No. 2', 'site_leaders', 6),
  ('Rover', 'division_resources', 7)
ON CONFLICT (label) DO NOTHING;

CREATE TABLE IF NOT EXISTS onsi_depth_chart_writers (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS onsi_writer_notes (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES onsi_depth_chart_writers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onsi_writer_notes_writer ON onsi_writer_notes(writer_id);

CREATE TABLE IF NOT EXISTS onsi_ignored_traffic_authors (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, author_name)
);

CREATE TABLE IF NOT EXISTS onsi_writer_aliases (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES onsi_depth_chart_writers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(writer_id, alias)
);
CREATE INDEX IF NOT EXISTS idx_onsi_writer_aliases_writer ON onsi_writer_aliases(writer_id);

CREATE TABLE IF NOT EXISTS onsi_traffic_imports (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  imported_by TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(site_id, period_key)
);

CREATE TABLE IF NOT EXISTS onsi_article_traffic (
  id SERIAL PRIMARY KEY,
  import_id INT NOT NULL REFERENCES onsi_traffic_imports(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  article_title TEXT NOT NULL,
  article_author TEXT,
  article_url TEXT,
  first_published_date DATE,
  pageviews INT NOT NULL DEFAULT 0,
  scroll_depth NUMERIC,
  avg_time_on_page NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_onsi_article_traffic_import ON onsi_article_traffic(import_id);
CREATE INDEX IF NOT EXISTS idx_onsi_article_traffic_site_pageviews ON onsi_article_traffic(site_id, pageviews DESC);
CREATE INDEX IF NOT EXISTS idx_onsi_article_traffic_site_author ON onsi_article_traffic(site_id, article_author);

CREATE TABLE IF NOT EXISTS onsi_site_traffic_archive (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS onsi_writer_traffic_archive (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES onsi_depth_chart_writers(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  articles_published INT NOT NULL DEFAULT 0,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  weighted_avg_scroll_depth NUMERIC,
  weighted_avg_time_on_page NUMERIC,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(writer_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_onsi_site_traffic_archive_site ON onsi_site_traffic_archive(site_id);
CREATE INDEX IF NOT EXISTS idx_onsi_writer_traffic_archive_writer ON onsi_writer_traffic_archive(writer_id);

CREATE TABLE IF NOT EXISTS onsi_site_traffic_snapshots (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  articles_published INT NOT NULL DEFAULT 0,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  published_pageviews BIGINT NOT NULL DEFAULT 0,
  evergreen_pageviews BIGINT NOT NULL DEFAULT 0,
  homepage_pageviews BIGINT NOT NULL DEFAULT 0,
  weighted_avg_scroll_depth NUMERIC,
  weighted_avg_time_on_page NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_onsi_site_traffic_snapshots_lookup
  ON onsi_site_traffic_snapshots(site_id, period_key, snapshot_at DESC);
ALTER TABLE onsi_site_traffic_snapshots ADD COLUMN IF NOT EXISTS published_pageviews BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS onsi_writer_traffic_snapshots (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES onsi_depth_chart_writers(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  articles_published INT NOT NULL DEFAULT 0,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  published_pageviews BIGINT NOT NULL DEFAULT 0,
  weighted_avg_scroll_depth NUMERIC,
  weighted_avg_time_on_page NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_onsi_writer_traffic_snapshots_lookup
  ON onsi_writer_traffic_snapshots(writer_id, period_key, snapshot_at DESC);
ALTER TABLE onsi_writer_traffic_snapshots ADD COLUMN IF NOT EXISTS published_pageviews BIGINT NOT NULL DEFAULT 0;

-- True day-over-day deltas for OnSI, mirroring site_daily_deltas /
-- writer_daily_deltas — computed once at upload time by matching every
-- individual article between the outgoing and incoming data, across ALL
-- authored content (not just newly-published pieces).
CREATE TABLE IF NOT EXISTS onsi_site_daily_deltas (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pv_delta BIGINT NOT NULL DEFAULT 0,
  scroll_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0,
  time_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_onsi_site_daily_deltas_lookup
  ON onsi_site_daily_deltas(site_id, period_key, captured_at DESC);

CREATE TABLE IF NOT EXISTS onsi_writer_daily_deltas (
  id SERIAL PRIMARY KEY,
  writer_id INT NOT NULL REFERENCES onsi_depth_chart_writers(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES onsi_sites(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pv_delta BIGINT NOT NULL DEFAULT 0,
  scroll_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0,
  time_weighted_sum_delta NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_onsi_writer_daily_deltas_lookup
  ON onsi_writer_daily_deltas(writer_id, period_key, captured_at DESC);
`;
