import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildMatchNames } from "@/lib/nameNormalize";

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
      SELECT id, site_name FROM sites WHERE division = ${division}
    `;
    const siteIds = (sitesInDivision as any[]).map((s) => s.id);
    const siteNameById = new Map<number, string>(
      (sitesInDivision as any[]).map((s) => [s.id, s.site_name])
    );
    if (siteIds.length === 0) {
      return NextResponse.json({ hasData: false });
    }

    const currentRows = await sql`
      SELECT at.site_id, at.article_author, at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ANY(${siteIds}::int[]) AND ti.period_key = ${periodKey}
    `;
    const bySiteAuthorCurrent = new Map<string, any[]>();
    const currentBySite = new Map<number, any[]>();
    for (const r of currentRows as any[]) {
      if (!currentBySite.has(r.site_id)) currentBySite.set(r.site_id, []);
      currentBySite.get(r.site_id)!.push(r);
      if (r.article_author !== null) {
        const key = `${r.site_id}::${String(r.article_author).trim().toLowerCase()}`;
        if (!bySiteAuthorCurrent.has(key)) bySiteAuthorCurrent.set(key, []);
        bySiteAuthorCurrent.get(key)!.push(r);
      }
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
      SELECT DISTINCT ON (site_id) site_id, articles_published, total_pageviews,
        weighted_avg_scroll_depth, weighted_avg_time_on_page, snapshot_at
      FROM site_traffic_snapshots
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
      ORDER BY site_id, snapshot_at DESC
    `;
    const prevBySite = new Map<number, any>((prevSiteRows as any[]).map((r) => [r.site_id, r]));

    const prevWriterRows = await sql`
      SELECT DISTINCT ON (writer_id) writer_id, articles_published, total_pageviews, snapshot_at
      FROM writer_traffic_snapshots
      WHERE site_id = ANY(${siteIds}::int[]) AND period_key = ${periodKey}
      ORDER BY writer_id, snapshot_at DESC
    `;
    const prevByWriter = new Map<number, any>(
      (prevWriterRows as any[]).map((r) => [r.writer_id, r])
    );

    type SiteDeltaRow = {
      siteId: number;
      siteName: string;
      currentArticlesPublished: number;
      currentTotalPageviews: number;
      articlesPublishedDelta: number;
      totalPageviewsDelta: number;
      hadPrevious: boolean;
    };
    const siteDeltas: SiteDeltaRow[] = [];
    let divCurrentArticles = 0;
    let divCurrentPv = 0;
    let divDeltaArticles = 0;
    let divDeltaPv = 0;
    let sitesWithPrevious = 0;

    for (const siteId of siteIds) {
      const rows = currentBySite.get(siteId) ?? [];
      const authored = rows.filter((r) => r.article_author !== null);
      const published = authored.filter((r) => r.published_month === periodKey);
      const currentArticlesPublished = published.length;
      const currentTotalPageviews = authored.reduce((s, r) => s + r.pageviews, 0);
      const prev = prevBySite.get(siteId);

      divCurrentArticles += currentArticlesPublished;
      divCurrentPv += currentTotalPageviews;

      if (prev) {
        sitesWithPrevious += 1;
        const articlesDelta = currentArticlesPublished - prev.articles_published;
        const pvDelta = currentTotalPageviews - Number(prev.total_pageviews);
        divDeltaArticles += articlesDelta;
        divDeltaPv += pvDelta;
        siteDeltas.push({
          siteId,
          siteName: siteNameById.get(siteId) ?? "",
          currentArticlesPublished,
          currentTotalPageviews,
          articlesPublishedDelta: articlesDelta,
          totalPageviewsDelta: pvDelta,
          hadPrevious: true,
        });
      } else if (rows.length > 0) {
        siteDeltas.push({
          siteId,
          siteName: siteNameById.get(siteId) ?? "",
          currentArticlesPublished,
          currentTotalPageviews,
          articlesPublishedDelta: 0,
          totalPageviewsDelta: 0,
          hadPrevious: false,
        });
      }
    }
    siteDeltas.sort((a, b) => b.totalPageviewsDelta - a.totalPageviewsDelta);

    type WriterDeltaRow = {
      writerId: number;
      name: string;
      siteId: number;
      siteName: string;
      isSiteLeader: boolean;
      currentArticlesPublished: number;
      articlesPublishedDelta: number;
      totalPageviewsDelta: number;
      hadPrevious: boolean;
    };
    const writerDeltas: WriterDeltaRow[] = [];
    for (const w of writers as any[]) {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const wRows = matchNames.flatMap((mn) => bySiteAuthorCurrent.get(`${w.site_id}::${mn}`) ?? []);
      const wPublished = wRows.filter((r) => r.published_month === periodKey);
      const currentArticlesPublished = wPublished.length;
      const currentTotalPageviews = wRows.reduce((s, r) => s + r.pageviews, 0);
      const prev = prevByWriter.get(w.id);
      writerDeltas.push({
        writerId: w.id,
        name: w.name,
        siteId: w.site_id,
        siteName: siteNameById.get(w.site_id) ?? "",
        isSiteLeader: w.is_site_leader,
        currentArticlesPublished,
        articlesPublishedDelta: currentArticlesPublished - (prev ? prev.articles_published : 0),
        totalPageviewsDelta: currentTotalPageviews - (prev ? Number(prev.total_pageviews) : 0),
        hadPrevious: Boolean(prev),
      });
    }

    const standouts = [...writerDeltas]
      .filter((w) => w.hadPrevious)
      .sort((a, b) => b.totalPageviewsDelta - a.totalPageviewsDelta)
      .slice(0, 10);

    const quietLeaders = writerDeltas.filter(
      (w) => w.isSiteLeader && w.currentArticlesPublished === 0
    );

    return NextResponse.json({
      hasData: true,
      hasPrevious: sitesWithPrevious > 0,
      periodKey,
      periodLabel,
      siteCount: siteIds.length,
      sitesWithPrevious,
      divisionTotals: {
        currentArticlesPublished: divCurrentArticles,
        currentTotalPageviews: divCurrentPv,
        articlesPublishedDelta: divDeltaArticles,
        totalPageviewsDelta: divDeltaPv,
      },
      siteDeltas,
      standouts,
      quietLeaders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
