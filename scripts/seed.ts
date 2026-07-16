// Run with: npx tsx scripts/seed.ts
// Requires DATABASE_URL set (in .env.local or exported in your shell).
// Safe to re-run: uses ON CONFLICT so it won't duplicate sites/scores.

import { neon } from "@neondatabase/serverless";
import nflData from "./seed-data.json";
import nbaData from "./nba-seed-data.json";
import mlbData from "./mlb-seed-data.json";
import nhlData from "./nhl-seed-data.json";
import ncaaData from "./ncaa-seed-data.json";
import localsData from "./locals-seed-data.json";
import { SCHEMA_SQL } from "../lib/schema";
import { splitSqlStatements } from "../lib/sqlUtils";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL before running the seed script.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const DIVISIONS: { division: string; data: any[] }[] = [
  { division: "NFL", data: nflData as any[] },
  { division: "NBA", data: nbaData as any[] },
  { division: "MLB", data: mlbData as any[] },
  { division: "NHL", data: nhlData as any[] },
  { division: "NCAA", data: ncaaData as any[] },
  { division: "Locals", data: localsData as any[] },
];

async function main() {
  const statements = splitSqlStatements(SCHEMA_SQL);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log("Schema ensured.");

  const categories = ["fan_authority", "editorial_instincts", "ownership", "leadership"] as const;

  let order = 0;
  for (const { division, data } of DIVISIONS) {
    for (const row of data) {
      order += 1;
      const siteRows = await sql`
        INSERT INTO sites (site_name, site_topic, leader_name, sort_order, division)
        VALUES (${row.site_name}, ${row.site_topic}, ${row.leader_name}, ${order}, ${division})
        ON CONFLICT (site_name) DO NOTHING
        RETURNING id
      `;
      let siteId = (siteRows as any[])[0]?.id;
      if (!siteId) {
        const existing = await sql`SELECT id FROM sites WHERE site_name = ${row.site_name}`;
        siteId = (existing as any[])[0]?.id;
        // Backfill division for sites that existed before this column did.
        await sql`UPDATE sites SET division = ${division} WHERE id = ${siteId} AND (division IS NULL OR division = '')`;
      }
      if (!siteId) continue;

      for (const cat of categories) {
        await sql`
          INSERT INTO scores (site_id, category, score, note, is_canonized)
          VALUES (${siteId}, ${cat}, ${row[cat]}, '', FALSE)
          ON CONFLICT (site_id, category) DO NOTHING
        `;
      }
      console.log(`Seeded [${division}]: ${row.site_name} (${row.site_topic})`);
    }
  }

  console.log("Done. All scores were inserted as UN-canonized placeholders.");
  console.log("Hit 'Canonize All' in the app once real numbers are locked in.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
