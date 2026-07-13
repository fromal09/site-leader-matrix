import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { siteId } = await params;
  const siteIdNum = Number(siteId);

  try {
    const latestRows = await sql`
      SELECT MAX(period_key) AS period_key FROM traffic_imports WHERE site_id = ${siteIdNum}
    `;
    const latestPeriodKey = (latestRows as any[])[0]?.period_key;
    if (!latestPeriodKey) {
      return NextResponse.json({ periodKey: null, periodLabel: null, writers: {} });
    }

    const periodLabelRows = await sql`
      SELECT period_label FROM traffic_imports
      WHERE site_id = ${siteIdNum} AND period_key = ${latestPeriodKey}
      LIMIT 1
    `;
    const periodLabel = (periodLabelRows as any[])[0]?.period_label ?? latestPeriodKey;

    const writers = await sql`
      SELECT id, name, traffic_dashboard_name FROM depth_chart_writers
      WHERE site_id = ${siteIdNum} AND archived = FALSE
    `;

    const articleRows = await sql`
      SELECT at.article_author, at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${latestPeriodKey}
        AND at.article_author IS NOT NULL
    `;

    const byAuthor = new Map<string, any[]>();
    for (const r of articleRows as any[]) {
      const key = String(r.article_author).trim().toLowerCase();
      if (!key) continue;
      if (!byAuthor.has(key)) byAuthor.set(key, []);
      byAuthor.get(key)!.push(r);
    }

    const result: Record<
      number,
      {
        articlesPublished: number;
        totalPageviews: number;
        weightedAvgScrollDepth: number | null;
        weightedAvgTimeOnPage: number | null;
      }
    > = {};

    for (const w of writers as any[]) {
      const matchName = (w.traffic_dashboard_name || w.name || "").trim().toLowerCase();
      const rows = matchName ? byAuthor.get(matchName) ?? [] : [];
      if (rows.length === 0) continue;

      const articlesPublished = rows.filter((r) => r.published_month === latestPeriodKey).length;
      const totalPageviews = rows.reduce((sum, r) => sum + r.pageviews, 0);

      const scrollRows = rows.filter((r) => r.scroll_depth !== null);
      const scrollDenom = scrollRows.reduce((sum, r) => sum + r.pageviews, 0);
      const weightedAvgScrollDepth =
        scrollRows.length > 0 && scrollDenom > 0
          ? scrollRows.reduce((sum, r) => sum + r.scroll_depth * r.pageviews, 0) / scrollDenom
          : null;

      const timeRows = rows.filter((r) => r.avg_time_on_page !== null);
      const timeDenom = timeRows.reduce((sum, r) => sum + r.pageviews, 0);
      const weightedAvgTimeOnPage =
        timeRows.length > 0 && timeDenom > 0
          ? timeRows.reduce((sum, r) => sum + r.avg_time_on_page * r.pageviews, 0) / timeDenom
          : null;

      result[w.id] = {
        articlesPublished,
        totalPageviews,
        weightedAvgScrollDepth,
        weightedAvgTimeOnPage,
      };
    }

    return NextResponse.json({ periodKey: latestPeriodKey, periodLabel, writers: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
