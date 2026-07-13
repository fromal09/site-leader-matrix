// Run with: npx tsx scripts/seed.ts
// Requires DATABASE_URL set (in .env.local or exported in your shell).
// Safe to re-run: uses ON CONFLICT so it won't duplicate sites/scores.

import { neon } from "@neondatabase/serverless";
import data from "./seed-data.json";
import { SCHEMA_SQL } from "../lib/schema";
import { splitSqlStatements } from "../lib/sqlUtils";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL before running the seed script.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const statements = splitSqlStatements(SCHEMA_SQL);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log("Schema ensured.");

  const categories = ["fan_authority", "editorial_instincts", "ownership", "leadership"] as const;

  let order = 0;
  for (const row of data as any[]) {
    order += 1;
    const siteRows = await sql`
      INSERT INTO sites (site_name, site_topic, leader_name, sort_order)
      VALUES (${row.site_name}, ${row.site_topic}, ${row.leader_name}, ${order})
      ON CONFLICT (site_name) DO NOTHING
      RETURNING id
    `;
    let siteId = (siteRows as any[])[0]?.id;
    if (!siteId) {
      const existing = await sql`SELECT id FROM sites WHERE site_name = ${row.site_name}`;
      siteId = (existing as any[])[0]?.id;
    }
    if (!siteId) continue;

    for (const cat of categories) {
      await sql`
        INSERT INTO scores (site_id, category, score, note, is_canonized)
        VALUES (${siteId}, ${cat}, ${row[cat]}, '', FALSE)
        ON CONFLICT (site_id, category) DO NOTHING
      `;
    }
    console.log(`Seeded: ${row.site_name} (${row.site_topic})`);
  }

  console.log("Done. All scores were inserted as UN-canonized placeholders.");
  console.log("Hit 'Canonize All' in the app once real numbers are locked in.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
