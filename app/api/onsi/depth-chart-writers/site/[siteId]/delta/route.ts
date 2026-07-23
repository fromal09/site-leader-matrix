import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteId } = await params;
  const siteIdNum = Number(siteId);

  try {
    const periodRows = await sql`
      SELECT period_key, period_label FROM onsi_traffic_imports
      WHERE site_id = ${siteIdNum}
      ORDER BY period_key DESC LIMIT 1
    `;
    const latest = (periodRows as any[])[0];
    if (!latest) {
      return NextResponse.json({ hasData: false });
    }
    const periodKey = latest.period_key;
    const periodLabel = latest.period_label;

    const writers = await sql`
      SELECT dcw.id, dcw.name, dcw.traffic_dashboard_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM onsi_depth_chart_writers dcw
      LEFT JOIN onsi_writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.site_id = ${siteIdNum} AND dcw.archived = FALSE
      GROUP BY dcw.id
    `;
    const articleRows = await sql`
      SELECT at.article_author, at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month
      FROM onsi_article_traffic at
      JOIN onsi_traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${periodKey}
    `;
    const rowsArr = articleRows as any[];
    const authored = rowsArr.filter((r) => r.article_author !== null);
    const published = authored.filter((r) => r.published_month === periodKey);

    const currentSite = {
      articlesPublished: published.length,
      totalPageviews: authored.reduce((s, r) => s + r.pageviews, 0),
      weightedAvgScrollDepth: pageviewWeightedAverage(
        authored.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
      ),
      weightedAvgTimeOnPage: pageviewWeightedAverage(
        authored.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
      ),
    };

    const byAuthor = new Map<string, any[]>();
    for (const r of authored) {
      const key = String(r.article_author).trim().toLowerCase();
      if (!byAuthor.has(key)) byAuthor.set(key, []);
      byAuthor.get(key)!.push(r);
    }
    const currentByWriter = new Map<
      number,
      { articlesPublished: number; totalPageviews: number }
    >();
    for (const w of writers as any[]) {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const wRows = matchNames.flatMap((mn) => byAuthor.get(mn) ?? []);
      const wPublished = wRows.filter((r) => r.published_month === periodKey);
      currentByWriter.set(w.id, {
        articlesPublished: wPublished.length,
        totalPageviews: wRows.reduce((s, r) => s + r.pageviews, 0),
      });
    }

    // Most recent snapshot before the last replace — the "previous upload".
    const prevSiteRows = await sql`
      SELECT * FROM onsi_site_traffic_snapshots
      WHERE site_id = ${siteIdNum} AND period_key = ${periodKey}
      ORDER BY snapshot_at DESC LIMIT 1
    `;
    const prevSite = (prevSiteRows as any[])[0];

    if (!prevSite) {
      return NextResponse.json({ hasData: true, hasPrevious: false, periodKey, periodLabel });
    }

    const prevWriterRows = await sql`
      SELECT DISTINCT ON (writer_id) writer_id, articles_published, total_pageviews, snapshot_at
      FROM onsi_writer_traffic_snapshots
      WHERE site_id = ${siteIdNum} AND period_key = ${periodKey}
      ORDER BY writer_id, snapshot_at DESC
    `;
    const prevByWriter = new Map<number, any>(
      (prevWriterRows as any[]).map((r) => [r.writer_id, r])
    );

    const siteDelta = {
      articlesPublished: currentSite.articlesPublished - prevSite.articles_published,
      totalPageviews: currentSite.totalPageviews - Number(prevSite.total_pageviews),
      weightedAvgScrollDepth:
        currentSite.weightedAvgScrollDepth !== null && prevSite.weighted_avg_scroll_depth !== null
          ? currentSite.weightedAvgScrollDepth - Number(prevSite.weighted_avg_scroll_depth)
          : null,
      weightedAvgTimeOnPage:
        currentSite.weightedAvgTimeOnPage !== null && prevSite.weighted_avg_time_on_page !== null
          ? currentSite.weightedAvgTimeOnPage - Number(prevSite.weighted_avg_time_on_page)
          : null,
    };

    const writerDeltas = (writers as any[]).map((w) => {
      const current = currentByWriter.get(w.id)!;
      const prev = prevByWriter.get(w.id);
      return {
        writerId: w.id,
        name: w.name,
        currentArticlesPublished: current.articlesPublished,
        articlesPublishedDelta: current.articlesPublished - (prev ? prev.articles_published : 0),
        totalPageviewsDelta: current.totalPageviews - (prev ? Number(prev.total_pageviews) : 0),
        hadPrevious: Boolean(prev),
      };
    });

    return NextResponse.json({
      hasData: true,
      hasPrevious: true,
      periodKey,
      periodLabel,
      previousSnapshotAt: prevSite.snapshot_at,
      currentSite,
      siteDelta,
      writerDeltas,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
