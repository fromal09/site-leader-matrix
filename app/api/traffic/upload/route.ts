import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { ParsedTrafficRow } from "@/lib/traffic";

export const maxDuration = 60;

const CHUNK_SIZE = 2000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { siteId, hostname, periodKey, periodLabel, rows } = await req.json();

  if (!siteId || !periodKey || !periodLabel) {
    return NextResponse.json({ error: "Missing site or period." }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }

  const siteIdNum = Number(siteId);

  try {
    if (hostname) {
      await sql`
        UPDATE sites SET hostname = ${hostname}
        WHERE id = ${siteIdNum} AND (hostname IS NULL OR hostname <> ${hostname})
      `;
    }

    // Replace semantics: re-uploading the same site+month overwrites what's there.
    const existing = await sql`
      SELECT id FROM traffic_imports WHERE site_id = ${siteIdNum} AND period_key = ${periodKey}
    `;
    let importId: number;
    if ((existing as any[])[0]) {
      importId = (existing as any[])[0].id;
      await sql`DELETE FROM article_traffic WHERE import_id = ${importId}`;
      await sql`
        UPDATE traffic_imports
        SET period_label = ${periodLabel}, row_count = ${rows.length},
            imported_by = ${session.name}, imported_at = now()
        WHERE id = ${importId}
      `;
    } else {
      const inserted = await sql`
        INSERT INTO traffic_imports (site_id, period_key, period_label, row_count, imported_by)
        VALUES (${siteIdNum}, ${periodKey}, ${periodLabel}, ${rows.length}, ${session.name})
        RETURNING id
      `;
      importId = (inserted as any[])[0].id;
    }

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk: ParsedTrafficRow[] = rows.slice(i, i + CHUNK_SIZE);
      const titles = chunk.map((r) => r.title);
      const authors = chunk.map((r) => r.author);
      const urls = chunk.map((r) => r.url);
      const dates = chunk.map((r) => r.firstPublishedDate);
      const pageviews = chunk.map((r) => r.pageviews);
      const scrollDepths = chunk.map((r) => r.scrollDepth);
      const avgTimes = chunk.map((r) => r.avgTimeOnPage);

      await sql`
        INSERT INTO article_traffic
          (import_id, site_id, article_title, article_author, article_url, first_published_date, pageviews, scroll_depth, avg_time_on_page)
        SELECT ${importId}, ${siteIdNum}, t, a, u, d::date, p, sd, at
        FROM UNNEST(
          ${titles}::text[],
          ${authors}::text[],
          ${urls}::text[],
          ${dates}::text[],
          ${pageviews}::int[],
          ${scrollDepths}::numeric[],
          ${avgTimes}::numeric[]
        ) AS unnested(t, a, u, d, p, sd, at)
      `;
    }

    return NextResponse.json({ ok: true, importId, rowCount: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
