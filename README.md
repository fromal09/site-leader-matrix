# Site Leader Matrix — NFL Division

Scouting-style dashboard for grading FanSided NFL site leaders across four quadrants:
**Fan Authority, Editorial Instincts, Ownership, Leadership.**

- Division overview: mini radar card per site (grid), a division-average radar,
  sortable by any single quadrant, and an auto-generated + editable trends panel.
- Leader detail page: full radar with hover notes, inline score/note editing,
  and a history log once a site is "canonized."
- Scores start as **placeholders** (seeded from your CSV). Nothing is tracked as
  history until you hit **Canonize** — that locks the current numbers in as the
  official baseline. Every edit after that is logged with who changed it and when.
- Editing requires manager sign-in: a name + the shared password
  (`SITE_PASSWORD` env var). The name is stored so history entries show who made
  each change.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind v4 + Neon Postgres (serverless
driver) + Recharts. Deploys to Vercel.

## 1. Set up the database (Neon)

1. In your Vercel project, go to **Storage → Create Database → Neon** (or
   create a database directly at neon.tech and copy the connection string).
2. Grab the pooled connection string — it looks like
   `postgres://user:password@host/dbname?sslmode=require`.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` for local dev, and add the same three vars
in **Vercel → Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `SITE_PASSWORD` | Shared password managers use to sign in (e.g. `halftimeinactives`) |
| `AUTH_SECRET` | Any long random string, used to sign session cookies |

## 3. Create the schema + seed the CSV data

With `DATABASE_URL` set locally (`.env.local` or exported in your shell):

```bash
npm install
npx tsx scripts/seed.ts
```

This creates the tables (`schema.sql`) and inserts all 32 sites with their
starting scores as **un-canonized placeholders**. It's safe to re-run — it
won't duplicate rows.

If you add a new site leader later, add a row to `scripts/seed-data.json` and
re-run the seed script, or just add it directly in Neon's SQL editor.

## 4. Run locally

```bash
npm run dev
```

## 5. Deploy

```bash
vercel deploy
```
(or connect the GitHub repo to Vercel for auto-deploys). Make sure the three
env vars above are set in the Vercel project first.

## How canonizing works

- On the division page, a **"Canonize N placeholder scores"** button appears
  whenever any score hasn't been locked in yet. Click it (after signing in) to
  mark all current scores as official — this writes the first history entry
  for each one.
- On a leader's page, you can canonize just that site (useful when you add a
  new site leader later without disturbing everyone else's history).
- Once canonized, every score/note edit automatically appends to that site's
  history log, so you can see how a leader progressed or regressed over time.

## Project structure

```
app/
  page.tsx                Division overview
  leader/[id]/page.tsx    Leader detail page
  api/
    auth/                 Sign in / out
    sites/                List + single-site fetch
    scores/[siteId]/      Edit a category score/note
    canonize/             Lock in placeholder scores
    history/[siteId]/     Score history log
    division-notes/       Editable trends commentary
components/                UI (radar cards, editors, trends panel, login modal)
lib/                       Categories, grading logic, stats, types, db/auth clients
schema.sql                 Postgres schema
scripts/seed.ts            One-time / idempotent data loader
scripts/seed-data.json     CSV converted to JSON (source of truth for seeding)
```
