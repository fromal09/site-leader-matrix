import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage, dedupeArticles } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

type Metrics = {
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

type TodayMetrics = {
  totalPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

function computeMetrics(rawRows: any[]): Metrics {
  const publishedRows = dedupeArticles(rawRows);
  const publishedPv = publishedRows.reduce((s, r) => s + r.pageviews, 0);
  return {
    articlesPublished: publishedRows.length,
    totalPageviews: publishedPv,
    pvPerPublishedArticle: publishedRows.length > 0 ? publishedPv / publishedRows.length : null,
    weightedAvgScrollDepth: pageviewWeightedAverage(
      publishedRows.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
    ),
    weightedAvgTimeOnPage: pageviewWeightedAverage(
      publishedRows.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
    ),
  };
}

// The true incremental picture since the last upload: built at upload time
// by matching every individual article (old vs new, across ALL authored
// content, not just newly-published pieces) — see app/api/traffic/upload.
// scroll/time here are absolute values (the weighted-average scroll depth
// OF the incremental pageviews), not a difference of two averages, since
// averages can't be subtracted that way.
function todayFromDailyDelta(row: any | undefined): TodayMetrics {
  if (!row) return { totalPageviews: 0, weightedAvgScrollDepth: null, weightedAvgTimeOnPage: null };
  const pv = Number(row.pv_delta ?? 0);
  const scrollSum = Number(row.scroll_weighted_sum_delta ?? 0);
  const timeSum = Number(row.time_weighted_sum_delta ?? 0);
  return {
    totalPageviews: pv,
    weightedAvgScrollDepth: pv > 0 ? scrollSum / pv : null,
    weightedAvgTimeOnPage: pv > 0 ? timeSum / pv : null,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const division = req.nextUrl.searchParams.get("division") ?? "NFL";

  try {
    const periodRows = await sql`
      SELECT DISTINCT ti.period_key, ti.period_label
      FROM traffic_imports ti
      JOIN sites s ON s.id = ti.site_id
      WHERE s.division = ${division}
      ORDER BY ti.period_key DESC
      LIMIT 1
    `;
    const latest = (periodRows as any[])[0];
    if (!latest) {
      return NextResponse.json({ hasData: false });
    }
    const periodKey = latest.period_key;
    const periodLabel = latest.period_label;

    const sitesInDivision = await sql`
      SELECT id, site_name, leader_name FROM sites WHERE division = ${division}
    `;
    const siteIds = (sitesInDivision as any[]).map((s) => s.id);
    const siteNameById = new Map<number, string>(
      (sitesInDivision as any[]).map((s) => [s.id, s.site_name])
    );
    if (siteIds.length === 0) {
      return NextResponse.json({ hasData: false });
    }

    const importDates = await sql`
      SELECT site_id, imported_at FROM traffic_imports
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
    `;
    const allImportDates = (importDates as any[]).map((r) => new Date(r.imported_at).getTime());
    const currentDataAsOf = allImportDates.length
      ? new Date(Math.max(...allImportDates)).toISOString()
      : null;

    const currentRows = await sql`
      SELECT at.site_id, at.article_author, at.article_url, at.article_title,
        at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ANY(${siteIds}::int[]) AND ti.period_key = ${periodKey}
        AND at.article_author IS NOT NULL
    `;
    const bySiteAuthorCurrent = new Map<string, any[]>();
    const currentBySite = new Map<number, any[]>();
    for (const r of currentRows as any[]) {
      if (!currentBySite.has(r.site_id)) currentBySite.set(r.site_id, []);
      currentBySite.get(r.site_id)!.push(r);
      const key = `${r.site_id}::${String(r.article_author).trim().toLowerCase()}`;
      if (!bySiteAuthorCurrent.has(key)) bySiteAuthorCurrent.set(key, []);
      bySiteAuthorCurrent.get(key)!.push(r);
    }

    const writers = await sql`
      SELECT dcw.id, dcw.site_id, dcw.name, dcw.role, dcw.traffic_dashboard_name,
        COALESCE(array_agg(DISTINCT wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases,
        COALESCE(bool_or(dr.section = 'site_leaders'), FALSE) AS is_site_leader,
        COALESCE(bool_or(TRIM(LOWER(dcw.role)) IN ('site editor', 'site expert')), FALSE) AS is_site_editor_or_expert
      FROM depth_chart_writers dcw
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      LEFT JOIN depth_chart_roles dr ON TRIM(LOWER(dr.label)) = TRIM(LOWER(dcw.role))
      WHERE dcw.site_id = ANY(${siteIds}::int[]) AND dcw.archived = FALSE
      GROUP BY dcw.id
    `;

    const prevSiteRows = await sql`
      SELECT DISTINCT ON (site_id) *
      FROM site_traffic_snapshots
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
      ORDER BY site_id, snapshot_at DESC
    `;
    const prevBySite = new Map<number, any>((prevSiteRows as any[]).map((r) => [r.site_id, r]));
    const allSnapshotDates = (prevSiteRows as any[]).map((r) => new Date(r.snapshot_at).getTime());
    const previousDataAsOf = allSnapshotDates.length
      ? new Date(Math.max(...allSnapshotDates)).toISOString()
      : null;

    const prevWriterRows = await sql`
      SELECT DISTINCT ON (writer_id) *
      FROM writer_traffic_snapshots
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
      ORDER BY writer_id, snapshot_at DESC
    `;
    const prevByWriter = new Map<number, any>(
      (prevWriterRows as any[]).map((r) => [r.writer_id, r])
    );

    // The true per-article-matched incremental deltas, captured once at
    // upload time — see app/api/traffic/upload.
    const siteDailyDeltaRows = await sql`
      SELECT DISTINCT ON (site_id) *
      FROM site_daily_deltas
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
      ORDER BY site_id, captured_at DESC
    `;
    const dailyDeltaBySite = new Map<number, any>(
      (siteDailyDeltaRows as any[]).map((r) => [r.site_id, r])
    );
    const writerDailyDeltaRows = await sql`
      SELECT DISTINCT ON (writer_id) *
      FROM writer_daily_deltas
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
      ORDER BY writer_id, captured_at DESC
    `;
    const dailyDeltaByWriter = new Map<number, any>(
      (writerDailyDeltaRows as any[]).map((r) => [r.writer_id, r])
    );

    // Per-writer current metrics + true incremental, division-wide.
    const writerResults = (writers as any[]).map((w) => {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const wRows = matchNames.flatMap((mn) => bySiteAuthorCurrent.get(`${w.site_id}::${mn}`) ?? []);
      const wPublished = wRows.filter((r) => r.published_month === periodKey);
      const current = computeMetrics(wPublished);
      const today = todayFromDailyDelta(dailyDeltaByWriter.get(w.id));
      const prevSnap = prevByWriter.get(w.id);
      const articlesPublishedDelta = prevSnap
        ? current.articlesPublished - Number(prevSnap.articles_published ?? 0)
        : null;
      return {
        writerId: w.id,
        name: w.name,
        siteId: w.site_id,
        siteName: siteNameById.get(w.site_id) ?? "",
        isSiteLeader: w.is_site_leader,
        isSiteEditorOrExpert: w.is_site_editor_or_expert,
        current,
        today,
        articlesPublishedDelta,
        hadPrevious: Boolean(prevSnap),
      };
    });

    // Per-site current metrics + true incremental, with each site's writer
    // breakdown nested.
    const siteDeltas = siteIds
      .map((siteId) => {
        const rows = currentBySite.get(siteId) ?? [];
        const published = rows.filter((r) => r.published_month === periodKey);
        const current = computeMetrics(published);
        const today = todayFromDailyDelta(dailyDeltaBySite.get(siteId));
        const prevSnap = prevBySite.get(siteId);
        const articlesPublishedDelta = prevSnap
          ? current.articlesPublished - Number(prevSnap.articles_published ?? 0)
          : null;
        const siteWriters = writerResults
          .filter((w) => w.siteId === siteId && w.current.articlesPublished > 0)
          .sort((a, b) => b.current.totalPageviews - a.current.totalPageviews);
        return {
          siteId,
          siteName: siteNameById.get(siteId) ?? "",
          current,
          today,
          articlesPublishedDelta,
          hadPrevious: Boolean(prevSnap),
          writers: siteWriters,
        };
      })
      .filter((s) => (currentBySite.get(s.siteId) ?? []).length > 0)
      .sort((a, b) => b.today.totalPageviews - a.today.totalPageviews);

    const divCurrentArticles = siteDeltas.reduce((s, d) => s + d.current.articlesPublished, 0);
    const divCurrentPv = siteDeltas.reduce((s, d) => s + d.current.totalPageviews, 0);
    const sitesWithPrevious = siteDeltas.filter((d) => d.hadPrevious).length;
    const divDeltaArticles = siteDeltas.reduce((s, d) => s + (d.articlesPublishedDelta ?? 0), 0);
    const divTodayPv = siteDeltas.reduce((s, d) => s + d.today.totalPageviews, 0);

    const standouts = writerResults
      .filter((w) => w.hadPrevious && w.today.totalPageviews > 0)
      .sort((a, b) => b.today.totalPageviews - a.today.totalPageviews)
      .slice(0, 10);

    // Net-new articles per site leader since the last upload, best to worst
    // — sites with a Vacant leader never got a writer card in that role in
    // the first place, so they're already excluded without extra filtering.
    const siteLeaderArticles = writerResults
      .filter((w) => w.isSiteLeader && w.hadPrevious)
      .sort((a, b) => (b.articlesPublishedDelta ?? 0) - (a.articlesPublishedDelta ?? 0));

    // Narrower than the list above — just Site Editor/Site Expert (not
    // "Site No. 2") — and only the ones who published nothing NEW since
    // the last upload specifically, not just nothing all month.
    const quietEditorsAndExperts = writerResults
      .filter((w) => w.isSiteEditorOrExpert && w.hadPrevious && (w.articlesPublishedDelta ?? 0) === 0)
      .sort((a, b) => a.siteName.localeCompare(b.siteName));

    return NextResponse.json({
      hasData: true,
      hasPrevious: sitesWithPrevious > 0,
      periodKey,
      periodLabel,
      currentDataAsOf,
      previousDataAsOf,
      siteCount: siteIds.length,
      sitesWithPrevious,
      divisionTotals: {
        current: {
          articlesPublished: divCurrentArticles,
          totalPageviews: divCurrentPv,
          pvPerPublishedArticle: divCurrentArticles > 0 ? divCurrentPv / divCurrentArticles : null,
        },
        delta: { articlesPublished: divDeltaArticles, totalPageviews: divTodayPv },
      },
      siteDeltas,
      standouts,
      siteLeaderArticles,
      quietEditorsAndExperts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
