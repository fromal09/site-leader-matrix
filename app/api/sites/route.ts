import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const sites = await sql`
      SELECT id, site_name, site_topic, leader_name, sort_order, hostname
      FROM sites
      WHERE archived = FALSE
      ORDER BY sort_order ASC, site_name ASC
    `;
    const scores = await sql`
      SELECT site_id, category, score::float8 AS score, note, is_canonized, updated_at, updated_by
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
