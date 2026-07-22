// Run with: npx tsx scripts/onsi-seed.ts
// Requires DATABASE_URL set (in .env.local or exported in your shell).
// Safe to re-run: uses ON CONFLICT so it won't duplicate sites.
//
// Seeds onsi_sites from the OnSI site-mapping/leadership list, and — since
// this was asked for explicitly — also creates a real writer card (role
// "Site Editor") for every site with a named leader, so each site's
// publisher shows up on its roster automatically rather than just sitting
// in the leader_name text field. Sites marked "Vacant" get no card, since
// there's no one to assign one to yet.

import { neon } from "@neondatabase/serverless";
import onsiData from "./onsi-seed-data.json";
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

  let order = 0;
  let cardsCreated = 0;

  for (const row of onsiData as any[]) {
    order += 1;
    const siteRows = await sql`
      INSERT INTO onsi_sites (site_name, site_topic, leader_name, sort_order, division, url_path)
      VALUES (${row.site_name}, ${row.site_topic}, ${row.leader_name}, ${order}, ${row.division}, ${row.url_path ?? null})
      ON CONFLICT (site_name) DO UPDATE SET
        leader_name = EXCLUDED.leader_name,
        division = EXCLUDED.division,
        url_path = COALESCE(EXCLUDED.url_path, onsi_sites.url_path)
      RETURNING id
    `;
    const siteId = (siteRows as any[])[0]?.id;
    if (!siteId) continue;

    if (row.leader_name && row.leader_name !== "Vacant") {
      // One card per (site, name) — re-running the seed won't create
      // duplicate cards for the same leader.
      const existingCard = await sql`
        SELECT id FROM onsi_depth_chart_writers
        WHERE site_id = ${siteId} AND name = ${row.leader_name} AND archived = FALSE
      `;
      if ((existingCard as any[]).length === 0) {
        const maxRows = await sql`
          SELECT COALESCE(MAX(sort_order), 0) AS max FROM onsi_depth_chart_writers WHERE site_id = ${siteId}
        `;
        const nextOrder = Number((maxRows as any[])[0].max) + 1;
        await sql`
          INSERT INTO onsi_depth_chart_writers (site_id, name, role, sort_order, created_by, updated_by)
          VALUES (${siteId}, ${row.leader_name}, 'Site Editor', ${nextOrder}, 'onsi-seed', 'onsi-seed')
        `;
        cardsCreated++;
      }
    }

    console.log(`Seeded [${row.division}]: ${row.site_name} — ${row.leader_name}`);
  }

  console.log(`Done. ${onsiData.length} sites seeded, ${cardsCreated} writer cards created.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
