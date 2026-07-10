import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const sites = await sql`
      SELECT id, site_name, site_topic, leader_name, sort_order
      FROM sites
      WHERE archived = FALSE
      ORDER BY sort_order ASC, site_name ASC
    `;
    const scores = await sql`
      SELECT site_id, category, score, note, is_canonized, updated_at, updated_by
      FROM scores
    `;

    const scoresBySite: Record<number, unknown[]> = {};
    for (const s of scores as any[]) {
      if (!scoresBySite[s.site_id]) scoresBySite[s.site_id] = [];
      scoresBySite[s.site_id].push(s);
    }

    const result = (sites as any[]).map((site) => ({
      ...site,
      scores: scoresBySite[site.id] ?? [],
    }));

    return NextResponse.json({ sites: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
