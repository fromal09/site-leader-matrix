import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to canonize." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const siteId: number | undefined = body?.siteId;

  try {
    const rows = siteId
      ? await sql`
          SELECT site_id, category, score, note FROM scores
          WHERE is_canonized = FALSE AND site_id = ${siteId}
        `
      : await sql`
          SELECT site_id, category, score, note FROM scores
          WHERE is_canonized = FALSE
        `;

    for (const r of rows as any[]) {
      await sql`
        INSERT INTO score_history (site_id, category, score, note, event_type, changed_by)
        VALUES (${r.site_id}, ${r.category}, ${r.score}, ${r.note}, 'canonized', ${session.name})
      `;
      await sql`
        UPDATE scores SET is_canonized = TRUE
        WHERE site_id = ${r.site_id} AND category = ${r.category}
      `;
    }

    return NextResponse.json({ ok: true, canonized: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
