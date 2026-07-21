import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { normalizeNameKey, buildMatchNames } from "@/lib/nameNormalize";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const division = req.nextUrl.searchParams.get("division") ?? "NFL";
  const requestedPeriod = req.nextUrl.searchParams.get("period");

  try {
    const latestBySite = await sql`
      SELECT site_id, MAX(period_key) AS period_key
      FROM traffic_imports
      GROUP BY site_id
    `;
    // When a specific period is requested (matching whatever the rest of
    // the page has selected), use that same period for every site instead
    // of each site's own independent latest — otherwise the leaderboard can
    // silently disagree with the Site Snapshot/cards shown right next to it.
    const latestMap = new Map<number, string>();
    for (const r of latestBySite as any[]) {
      latestMap.set(r.site_id, requestedPeriod || r.period_key);
    }
    if (latestMap.size === 0) {
      return NextResponse.json({ writers: [], cardsChecked: 0, cardsMatched: 0 });
    }

    const writers = await sql`
      SELECT dcw.id, dcw.site_id, dcw.name, dcw.role, dcw.traffic_dashboard_name,
        s.site_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM depth_chart_writers dcw
      JOIN sites s ON s.id = dcw.site_id
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.archived = FALSE AND (${division} = 'ALL' OR s.division = ${division})
      GROUP BY dcw.id, s.site_name
    `;

    // One query across every site's relevant period, aggregated in JS per
    // (site, author) — same approach as the per-site route, just wider.
    const articleRows = requestedPeriod
      ? await sql`
          SELECT at.site_id, at.article_author, at.pageviews::float8 AS pageviews,
            at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
            TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month,
            ti.period_key, ti.period_label
          FROM article_traffic at
          JOIN traffic_imports ti ON ti.id = at.import_id
          WHERE at.article_author IS NOT NULL AND ti.period_key = ${requestedPeriod}
        `
      : await sql`
          SELECT at.site_id, at.article_author, at.pageviews::float8 AS pageviews,
            at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
            TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month,
            ti.period_key, ti.period_label
          FROM article_traffic at
          JOIN traffic_imports ti ON ti.id = at.import_id
          WHERE at.article_author IS NOT NULL
        `;

    const byKey = new Map<string, any[]>();
    for (const r of articleRows as any[]) {
      const latestForSite = latestMap.get(r.site_id);
      if (!latestForSite || r.period_key !== latestForSite) continue;
      const key = `${r.site_id}::${String(r.article_author).trim().toLowerCase()}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(r);
    }

    // If a writer's raw article_traffic for their site's relevant period has
    // been archived (see /api/admin/archive-old-traffic), they won't have
    // any rows in byKey above. writer_traffic_archive is already keyed by
    // writer_id directly (the author-name matching happened once, at
    // archive time), so this is a simple lookup rather than a re-match.
    const relevantPeriods = Array.from(new Set(Array.from(latestMap.values())));
    const archiveRows =
      relevantPeriods.length > 0
        ? await sql`
            SELECT writer_id, period_key, period_label, articles_published, total_pageviews,
              weighted_avg_scroll_depth, weighted_avg_time_on_page
            FROM writer_traffic_archive
            WHERE period_key = ANY(${relevantPeriods}::text[])
          `
        : [];
    const archiveByWriter = new Map<number, any>(
      (archiveRows as any[]).map((r) => [r.writer_id, r])
    );

    const result = [];
    const seenSitePerson = new Set<string>();
    const writersArr = writers as any[];
    for (const w of writersArr) {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      if (matchNames.length === 0) continue;
      const dedupeKey = `${w.site_id}::${normalizeNameKey(w.name)}`;
      if (seenSitePerson.has(dedupeKey)) continue;
      const rows = matchNames.flatMap((mn) => byKey.get(`${w.site_id}::${mn}`) ?? []);
      const latestPeriodKey = latestMap.get(w.site_id)!;

      if (rows.length === 0) {
        const archived = archiveByWriter.get(w.id);
        if (!archived || archived.period_key !== latestPeriodKey) continue;
        seenSitePerson.add(dedupeKey);
        result.push({
          writerId: w.id,
          name: w.name,
          role: w.role,
          siteId: w.site_id,
          siteName: w.site_name,
          periodLabel: archived.period_label,
          articlesPublished: Number(archived.articles_published),
          totalPageviews: Number(archived.total_pageviews),
          pvPerPublishedArticle:
            Number(archived.articles_published) > 0
              ? Number(archived.total_pageviews) / Number(archived.articles_published)
              : null,
          weightedAvgScrollDepth:
            archived.weighted_avg_scroll_depth !== null ? Number(archived.weighted_avg_scroll_depth) : null,
          weightedAvgTimeOnPage:
            archived.weighted_avg_time_on_page !== null ? Number(archived.weighted_avg_time_on_page) : null,
        });
        continue;
      }
      seenSitePerson.add(dedupeKey);

      const publishedRows = rows.filter((r) => r.published_month === latestPeriodKey);
      const publishedPageviews = publishedRows.reduce((sum, r) => sum + r.pageviews, 0);
      const totalPageviews = rows.reduce((sum, r) => sum + r.pageviews, 0);

      result.push({
        writerId: w.id,
        name: w.name,
        role: w.role,
        siteId: w.site_id,
        siteName: w.site_name,
        periodLabel: rows[0].period_label,
        articlesPublished: publishedRows.length,
        totalPageviews,
        pvPerPublishedArticle: publishedRows.length > 0 ? publishedPageviews / publishedRows.length : null,
        weightedAvgScrollDepth: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
        ),
        weightedAvgTimeOnPage: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
        ),
      });
    }

    return NextResponse.json({
      writers: result,
      cardsChecked: writersArr.length,
      cardsMatched: result.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
