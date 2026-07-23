import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeEngagementScore } from "@/lib/engagementScore";
import { buildMatchNames } from "@/lib/nameNormalize";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { cardId } = await params;
  const requestedPeriod = req.nextUrl.searchParams.get("period");
  try {
    const writerRows = await sql`
      SELECT id, site_id, name, traffic_dashboard_name
      FROM onsi_depth_chart_writers WHERE id = ${Number(cardId)}
    `;
    const writer = (writerRows as any[])[0];
    if (!writer) {
      return NextResponse.json({ error: "Writer not found." }, { status: 404 });
    }

    const aliasRows = await sql`SELECT alias FROM onsi_writer_aliases WHERE writer_id = ${Number(cardId)}`;
    const matchNames = buildMatchNames(
      writer.name,
      writer.traffic_dashboard_name,
      (aliasRows as any[]).map((a) => a.alias)
    );
    if (matchNames.length === 0) {
      return NextResponse.json({ matched: false });
    }

    const rows = await sql`
      SELECT at.article_title, at.article_url,
        TO_CHAR(at.first_published_date, 'YYYY-MM-DD') AS first_published_date,
        at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        ti.period_key, ti.period_label
      FROM onsi_article_traffic at
      JOIN onsi_traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${writer.site_id}
        AND LOWER(TRIM(at.article_author)) = ANY(${matchNames}::text[])
      ORDER BY ti.period_key DESC, at.pageviews DESC
    `;

    const rowsArr = rows as any[];
    if (rowsArr.length === 0) {
      return NextResponse.json({ matched: false, matchName: matchNames[0] });
    }

    const latestPeriodKey = rowsArr[0].period_key;
    const availablePeriodKeys = new Set(rowsArr.map((r) => r.period_key));
    const selectedPeriodKey =
      requestedPeriod && availablePeriodKeys.has(requestedPeriod)
        ? requestedPeriod
        : latestPeriodKey;
    const latestPeriodLabel =
      rowsArr.find((r) => r.period_key === selectedPeriodKey)?.period_label ?? rowsArr[0].period_label;
    const latestRows = rowsArr.filter((r) => r.period_key === selectedPeriodKey);

    const publishedThisPeriod = latestRows.filter(
      (r) => r.first_published_date && String(r.first_published_date).slice(0, 7) === selectedPeriodKey
    );
    const evergreenRows = latestRows.filter(
      (r) => !(r.first_published_date && String(r.first_published_date).slice(0, 7) === selectedPeriodKey)
    );

    const totalPageviews = latestRows.reduce((sum, r) => sum + r.pageviews, 0);
    const evergreenPageviews = evergreenRows.reduce((sum, r) => sum + r.pageviews, 0);

    const scrollWeighted = latestRows.filter((r) => r.scroll_depth !== null);
    const weightedAvgScrollDepth =
      scrollWeighted.length > 0
        ? scrollWeighted.reduce((sum, r) => sum + r.scroll_depth * r.pageviews, 0) /
          Math.max(
            scrollWeighted.reduce((sum, r) => sum + r.pageviews, 0),
            1
          )
        : null;

    const timeWeighted = latestRows.filter((r) => r.avg_time_on_page !== null);
    const weightedAvgTimeOnPage =
      timeWeighted.length > 0
        ? timeWeighted.reduce((sum, r) => sum + r.avg_time_on_page * r.pageviews, 0) /
          Math.max(
            timeWeighted.reduce((sum, r) => sum + r.pageviews, 0),
            1
          )
        : null;

    const withScore = latestRows.map((r) => ({
      ...r,
      engagementScore: computeEngagementScore(r.pageviews, r.scroll_depth, r.avg_time_on_page),
    }));
    const topPerforming = [...withScore]
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 8);

    const recentArticles = [...latestRows]
      .filter((r) => r.first_published_date)
      .sort((a, b) => (a.first_published_date < b.first_published_date ? 1 : -1))
      .slice(0, 5);

    const publishedThisPeriodSorted = [...publishedThisPeriod].sort(
      (a, b) => b.pageviews - a.pageviews
    );

    const monthlyMap = new Map<
      string,
      { period_label: string; totalPageviews: number; articleCount: number }
    >();
    for (const r of rowsArr) {
      const key = r.period_key;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { period_label: r.period_label, totalPageviews: 0, articleCount: 0 });
      }
      const m = monthlyMap.get(key)!;
      m.totalPageviews += r.pageviews;
      m.articleCount += 1;
    }
    const monthly = Array.from(monthlyMap.entries())
      .map(([period_key, v]) => ({ period_key, ...v }))
      .sort((a, b) => a.period_key.localeCompare(b.period_key));

    return NextResponse.json({
      matched: true,
      matchName: matchNames[0],
      latestPeriodLabel,
      latestPeriodKey: selectedPeriodKey,
      stats: {
        articlesPublishedCount: publishedThisPeriod.length,
        totalPageviews,
        evergreenPageviews,
        weightedAvgScrollDepth,
        weightedAvgTimeOnPage,
      },
      topPerforming,
      recentArticles,
      publishedThisPeriod: publishedThisPeriodSorted,
      monthly,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
