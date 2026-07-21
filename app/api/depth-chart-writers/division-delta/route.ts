import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

type Metrics = {
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

function computeMetrics(publishedRows: any[]): Metrics {
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

function metricsFromSnapshot(snap: any): Metrics {
  const publishedPv = Number(snap.published_pageviews ?? 0);
  const articlesPublished = Number(snap.articles_published ?? 0);
  return {
    articlesPublished,
    totalPageviews: publishedPv,
    pvPerPublishedArticle: articlesPublished > 0 ? publishedPv / articlesPublished : null,
    weightedAvgScrollDepth:
      snap.weighted_avg_scroll_depth !== null ? Number(snap.weighted_avg_scroll_depth) : null,
    weightedAvgTimeOnPage:
      snap.weighted_avg_time_on_page !== null ? Number(snap.weighted_avg_time_on_page) : null,
  };
}

function delta(current: Metrics, previous: Metrics | null) {
  if (!previous) return null;
  return {
    articlesPublished: current.articlesPublished - previous.articlesPublished,
    totalPageviews: current.totalPageviews - previous.totalPageviews,
    pvPerPublishedArticle:
      current.pvPerPublishedArticle !== null && previous.pvPerPublishedArticle !== null
        ? current.pvPerPublishedArticle - previous.pvPerPublishedArticle
        : null,
    weightedAvgScrollDepth:
      current.weightedAvgScrollDepth !== null && previous.weightedAvgScrollDepth !== null
        ? current.weightedAvgScrollDepth - previous.weightedAvgScrollDepth
        : null,
    weightedAvgTimeOnPage:
      current.weightedAvgTimeOnPage !== null && previous.weightedAvgTimeOnPage !== null
        ? current.weightedAvgTimeOnPage - previous.weightedAvgTimeOnPage
        : null,
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

    // When each site in this division was actually uploaded — the "date of
    // the new data" the report is showing.
    const importDates = await sql`
      SELECT site_id, imported_at FROM traffic_imports
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
    `;
    const importedAtBySite = new Map<number, string>(
      (importDates as any[]).map((r) => [r.site_id, r.imported_at])
    );
    const allImportDates = (importDates as any[]).map((r) => new Date(r.imported_at).getTime());
    const currentDataAsOf = allImportDates.length
      ? new Date(Math.max(...allImportDates)).toISOString()
      : null;

    const currentRows = await sql`
      SELECT at.site_id, at.article_author, at.pageviews::float8 AS pageviews,
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
        COALESCE(bool_or(dr.section = 'site_leaders'), FALSE) AS is_site_leader
      FROM depth_chart_writers dcw
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      LEFT JOIN depth_chart_roles dr ON dr.label = dcw.role
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

    // Per-writer current metrics + delta, division-wide.
    const writerResults = (writers as any[]).map((w) => {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const wRows = matchNames.flatMap((mn) => bySiteAuthorCurrent.get(`${w.site_id}::${mn}`) ?? []);
      const wPublished = wRows.filter((r) => r.published_month === periodKey);
      const current = computeMetrics(wPublished);
      const prevSnap = prevByWriter.get(w.id);
      const prev = prevSnap ? metricsFromSnapshot(prevSnap) : null;
      return {
        writerId: w.id,
        name: w.name,
        siteId: w.site_id,
        siteName: siteNameById.get(w.site_id) ?? "",
        isSiteLeader: w.is_site_leader,
        current,
        delta: delta(current, prev),
        hadPrevious: Boolean(prevSnap),
      };
    });

    // Per-site current metrics + delta, with each site's writer breakdown nested.
    const siteDeltas = siteIds
      .map((siteId) => {
        const rows = currentBySite.get(siteId) ?? [];
        const published = rows.filter((r) => r.published_month === periodKey);
        const current = computeMetrics(published);
        const prevSnap = prevBySite.get(siteId);
        const prev = prevSnap ? metricsFromSnapshot(prevSnap) : null;
        const siteWriters = writerResults
          .filter((w) => w.siteId === siteId && w.current.articlesPublished > 0)
          .sort((a, b) => b.current.totalPageviews - a.current.totalPageviews);
        return {
          siteId,
          siteName: siteNameById.get(siteId) ?? "",
          importedAt: importedAtBySite.get(siteId) ?? null,
          current,
          delta: delta(current, prev),
          hadPrevious: Boolean(prevSnap),
          writers: siteWriters,
        };
      })
      .filter((s) => (currentBySite.get(s.siteId) ?? []).length > 0)
      .sort((a, b) => (b.delta?.totalPageviews ?? 0) - (a.delta?.totalPageviews ?? 0));

    const divCurrentArticles = siteDeltas.reduce((s, d) => s + d.current.articlesPublished, 0);
    const divCurrentPv = siteDeltas.reduce((s, d) => s + d.current.totalPageviews, 0);
    const sitesWithPrevious = siteDeltas.filter((d) => d.hadPrevious).length;
    const divDeltaArticles = siteDeltas.reduce((s, d) => s + (d.delta?.articlesPublished ?? 0), 0);
    const divDeltaPv = siteDeltas.reduce((s, d) => s + (d.delta?.totalPageviews ?? 0), 0);

    const standouts = writerResults
      .filter((w) => w.hadPrevious && w.delta)
      .sort((a, b) => (b.delta!.totalPageviews ?? 0) - (a.delta!.totalPageviews ?? 0))
      .slice(0, 10);

    // Every site leader's article count this period — sites with a Vacant
    // leader never got a writer card in that role in the first place, so
    // they're already excluded here without any extra filtering.
    const siteLeaderArticles = writerResults
      .filter((w) => w.isSiteLeader)
      .sort((a, b) => a.current.articlesPublished - b.current.articlesPublished);

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
        delta: { articlesPublished: divDeltaArticles, totalPageviews: divDeltaPv },
      },
      siteDeltas,
      standouts,
      siteLeaderArticles,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
