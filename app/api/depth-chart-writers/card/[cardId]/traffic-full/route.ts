import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { cardId } = await params;
  try {
    const writerRows = await sql`
      SELECT id, site_id, name, role, traffic_dashboard_name
      FROM depth_chart_writers WHERE id = ${Number(cardId)}
    `;
    const writer = (writerRows as any[])[0];
    if (!writer) {
      return NextResponse.json({ error: "Writer not found." }, { status: 404 });
    }

    const matchName = (writer.traffic_dashboard_name || writer.name || "").trim();
    if (!matchName) {
      return NextResponse.json({ writer, matched: false, articles: [] });
    }

    const rows = await sql`
      SELECT at.article_title, at.article_url,
        TO_CHAR(at.first_published_date, 'YYYY-MM-DD') AS first_published_date,
        at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        ti.period_key, ti.period_label
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${writer.site_id}
        AND LOWER(TRIM(at.article_author)) = LOWER(TRIM(${matchName}))
      ORDER BY ti.period_key DESC, at.pageviews DESC
    `;

    return NextResponse.json({ writer, matchName, matched: true, articles: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
