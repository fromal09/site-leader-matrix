import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage, dedupeArticles } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { siteId } = await params;
  const siteIdNum = Number(siteId);
  const requestedPeriod = req.nextUrl.searchParams.get("period");

  try {
    const periodRows = await sql`
      SELECT DISTINCT period_key, period_label FROM traffic_imports
      WHERE site_id = ${siteIdNum}
      ORDER BY period_key DESC
    `;
    const availablePeriods = (periodRows as any[]).map((r) => ({
      key: r.period_key,
      label: r.period_label,
    }));

    if (availablePeriods.length === 0) {
      return NextResponse.json({
        periodKey: null,
        periodLabel: null,
        availablePeriods: [],
        writers: {},
        siteTotals: null,
        homepageTraffic: null,
      });
    }

    const selectedPeriodKey =
      requestedPeriod && availablePeriods.some((p) => p.key === requestedPeriod)
        ? requestedPeriod
        : availablePeriods[0].key; // most recent, since sorted desc
    const periodLabel =
      availablePeriods.find((p) => p.key === selectedPeriodKey)?.label ?? selectedPeriodKey;

    const writers = await sql`
      SELECT dcw.id, dcw.name, dcw.traffic_dashboard_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM depth_chart_writers dcw
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.site_id = ${siteIdNum} AND dcw.archived = FALSE
      GROUP BY dcw.id
    `;

    const articleRows = await sql`
      SELECT at.article_author, at.article_url, at.article_title, at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${selectedPeriodKey}
        AND at.article_author IS NOT NULL
    `;

    const rowsArr = articleRows as any[];

    const homepageRows = await sql`
      SELECT at.article_title, at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${selectedPeriodKey}
        AND at.article_author IS NULL
      ORDER BY at.pageviews DESC
      LIMIT 10
    `;
    const homepageAllRows = await sql`
      SELECT COALESCE(SUM(at.pageviews), 0)::float8 AS total_pageviews, COUNT(*) AS page_count
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${selectedPeriodKey}
        AND at.article_author IS NULL
    `;
    const homepageTotals = (homepageAllRows as any[])[0];
    const homepageTraffic = {
      pages: homepageRows as any[],
      totalPageviews: Number(homepageTotals?.total_pageviews ?? 0),
      pageCount: Number(homepageTotals?.page_count ?? 0),
    };

    const publishedRows = dedupeArticles(rowsArr.filter((r) => r.published_month === selectedPeriodKey));
    const totalPageviews = rowsArr.reduce((sum, r) => sum + r.pageviews, 0);
    const publishedPageviews = publishedRows.reduce((sum, r) => sum + r.pageviews, 0);
    const evergreenPageviews = totalPageviews - publishedPageviews;
    const siteTotals = {
      articlesPublished: publishedRows.length,
      totalPageviews,
      evergreenPageviews,
      weightedAvgScrollDepth: pageviewWeightedAverage(
        rowsArr.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
      ),
      weightedAvgTimeOnPage: pageviewWeightedAverage(
        rowsArr.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
      ),
      pvPerPublishedArticle:
        publishedRows.length > 0 ? publishedPageviews / publishedRows.length : null,
    };

    const byAuthor = new Map<string, any[]>();
    for (const r of rowsArr) {
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
        publishedPageviews: number;
        pvPerPublishedArticle: number | null;
        weightedAvgScrollDepth: number | null;
        weightedAvgTimeOnPage: number | null;
      }
    > = {};

    for (const w of writers as any[]) {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const rows = matchNames.flatMap((mn) => byAuthor.get(mn) ?? []);
      if (rows.length === 0) continue;

      const writerPublishedRows = dedupeArticles(
        rows.filter((r) => r.published_month === selectedPeriodKey)
      );
      const articlesPublished = writerPublishedRows.length;
      const writerTotalPageviews = rows.reduce((sum, r) => sum + r.pageviews, 0);
      const writerPublishedPageviews = writerPublishedRows.reduce((sum, r) => sum + r.pageviews, 0);

      result[w.id] = {
        articlesPublished,
        totalPageviews: writerTotalPageviews,
        publishedPageviews: writerPublishedPageviews,
        pvPerPublishedArticle:
          articlesPublished > 0 ? writerPublishedPageviews / articlesPublished : null,
        weightedAvgScrollDepth: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
        ),
        weightedAvgTimeOnPage: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
        ),
      };
    }

    return NextResponse.json({
      periodKey: selectedPeriodKey,
      periodLabel,
      availablePeriods,
      writers: result,
      siteTotals,
      homepageTraffic,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
