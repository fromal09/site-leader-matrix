// One-time cleanup for a bug where re-running the seed script created a
// second copy of every site instead of skipping ones that already existed
// (the `sites` table was missing a UNIQUE constraint on site_name).
//
// This script is SAFE BY DEFAULT: it only prints what it would do.
// Nothing is deleted until you re-run it with --confirm.
//
//   npx tsx scripts/dedupe-sites.ts              (dry run, prints a plan)
//   npx tsx scripts/dedupe-sites.ts --confirm    (actually deletes duplicates)
//
// For each site_name with more than one row, it keeps the copy with the
// most canonized categories, then the most note text, then the lowest id
// (i.e. whichever row actually has your real work in it) and deletes the
// others. Deleting a site cascades to its scores/history via foreign keys.

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}
const sql = neon(DATABASE_URL);
const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const sites = await sql`
    SELECT s.id, s.site_name, s.site_topic, s.leader_name,
      COALESCE(sc.canonized_count, 0) AS canonized_count,
      COALESCE(sc.notes_len, 0) AS notes_len
    FROM sites s
    LEFT JOIN (
      SELECT site_id,
        SUM(CASE WHEN is_canonized THEN 1 ELSE 0 END) AS canonized_count,
        SUM(LENGTH(note)) AS notes_len
      FROM scores
      GROUP BY site_id
    ) sc ON sc.site_id = s.id
    ORDER BY s.site_name, s.id
  `;

  const groups: Record<string, any[]> = {};
  for (const row of sites as any[]) {
    groups[row.site_name] = groups[row.site_name] || [];
    groups[row.site_name].push(row);
  }

  let totalToDelete = 0;
  for (const [name, rows] of Object.entries(groups)) {
    if (rows.length <= 1) continue;
    const sorted = [...rows].sort((a, b) => {
      if (b.canonized_count !== a.canonized_count) return b.canonized_count - a.canonized_count;
      if (b.notes_len !== a.notes_len) return b.notes_len - a.notes_len;
      return a.id - b.id;
    });
    const keeper = sorted[0];
    const losers = sorted.slice(1);
    console.log(
      `\n${name}: keeping id=${keeper.id} (canonized=${keeper.canonized_count}, notes chars=${keeper.notes_len})`
    );
    for (const loser of losers) {
      console.log(
        `  -> would delete id=${loser.id} (canonized=${loser.canonized_count}, notes chars=${loser.notes_len})`
      );
      totalToDelete++;
      if (CONFIRM) {
        await sql`DELETE FROM sites WHERE id = ${loser.id}`;
      }
    }
  }

  if (totalToDelete === 0) {
    console.log("No duplicate sites found. Nothing to clean up.");
  } else if (!CONFIRM) {
    console.log(`\nDry run only — ${totalToDelete} duplicate row(s) would be deleted.`);
    console.log("Review the list above. If it looks right, re-run with --confirm:");
    console.log("  npx tsx scripts/dedupe-sites.ts --confirm");
    return;
  } else {
    console.log(`\nDeleted ${totalToDelete} duplicate site row(s).`);
  }

  // Prevent this from ever happening again.
  try {
    await sql.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'sites_site_name_key'
        ) THEN
          ALTER TABLE sites ADD CONSTRAINT sites_site_name_key UNIQUE (site_name);
        END IF;
      END $$;
    `);
    console.log("Added UNIQUE constraint on sites.site_name — this can't happen again.");
  } catch (err: any) {
    console.warn(
      "Could not add the UNIQUE constraint (duplicates may still remain):",
      err.message
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
