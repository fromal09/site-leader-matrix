import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const requestedPeriod = req.nextUrl.searchParams.get("period");
  const requestedDivision = req.nextUrl.searchParams.get("division");

  try {
    const periodRows = await sql`
      SELECT DISTINCT period_key, period_label FROM traffic_imports ORDER BY period_key DESC
    `;
    const availablePeriods = (periodRows as any[]).map((r) => ({
      key: r.period_key,
      label: r.period_label,
    }));
    if (availablePeriods.length === 0) {
      return NextResponse.json({
        sites: {},
        availablePeriods: [],
        selectedPeriod: null,
        divisionTotals: null,
        byDivision: {},
      });
    }

    const selectedPeriodKey =
      requestedPeriod && availablePeriods.some((p) => p.key === requestedPeriod)
        ? requestedPeriod
        : availablePeriods[0].key; // most recent, since sorted desc
    const selectedPeriodLabel =
      availablePeriods.find((p) => p.key === selectedPeriodKey)?.label ?? selectedPeriodKey;

    // Aggregated in SQL (not fetched row-by-row to JS) so this stays fast
    // regardless of how many articles are on file across all sites. Every
    // site is compared against the SAME period, not each site's own latest
    // (which could differ if upload cadence isn't synchronized).
    const rows = await sql`
      WITH matching_imports AS (
        SELECT id, site_id FROM traffic_imports WHERE period_key = ${selectedPeriodKey}
      )
      SELECT
        mi.site_id,
        s.division,
        COUNT(DISTINCT normalize_article_key(at.article_url, at.article_title, at.id)) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ${selectedPeriodKey}
        ) AS articles_published,
        COALESCE(SUM(at.pageviews), 0) AS total_pageviews,
        COALESCE(SUM(at.pageviews) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ${selectedPeriodKey}
        ), 0) AS published_pageviews,
        COALESCE(SUM(at.scroll_depth * at.pageviews) FILTER (WHERE at.scroll_depth IS NOT NULL), 0)
          AS scroll_weighted_sum,
        COALESCE(SUM(at.pageviews) FILTER (WHERE at.scroll_depth IS NOT NULL), 0)
          AS scroll_weight_denom,
        COALESCE(SUM(at.avg_time_on_page * at.pageviews) FILTER (WHERE at.avg_time_on_page IS NOT NULL), 0)
          AS time_weighted_sum,
        COALESCE(SUM(at.pageviews) FILTER (WHERE at.avg_time_on_page IS NOT NULL), 0)
          AS time_weight_denom,
        COUNT(DISTINCT at.article_author) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ${selectedPeriodKey}
        ) AS authors_published,
        COALESCE(SUM(at.pageviews) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ${selectedPeriodKey}
        ), 0)::float8 / NULLIF(COUNT(DISTINCT normalize_article_key(at.article_url, at.article_title, at.id)) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ${selectedPeriodKey}
        ), 0) AS pv_per_published_article
      FROM article_traffic at
      JOIN matching_imports mi ON mi.id = at.import_id
      JOIN sites s ON s.id = mi.site_id
      WHERE at.article_author IS NOT NULL
      GROUP BY mi.site_id, s.division
    `;

    // If a site's raw article_traffic for this period has been archived
    // (rolled up into site_traffic_archive and deleted to save storage —
    // see /api/admin/archive-old-traffic), it won't show up in the live
    // query above at all. Pull the archived rollups for the same period so
    // those sites still show their topline numbers instead of "no data".
    const archiveRows = await sql`
      SELECT sa.site_id, s.division, sa.articles_published, sa.total_pageviews,
        sa.evergreen_pageviews, sa.weighted_avg_scroll_depth, sa.weighted_avg_time_on_page
      FROM site_traffic_archive sa
      JOIN sites s ON s.id = sa.site_id
      WHERE sa.period_key = ${selectedPeriodKey}
    `;
    const liveSiteIds = new Set((rows as any[]).map((r) => r.site_id));
    const archiveOnlyRows = (archiveRows as any[])
      .filter((r) => !liveSiteIds.has(r.site_id))
      .map((r) => ({
        site_id: r.site_id,
        division: r.division,
        articles_published: r.articles_published,
        total_pageviews: r.total_pageviews,
        published_pageviews: Number(r.total_pageviews) - Number(r.evergreen_pageviews),
        scroll_weighted_sum:
          r.weighted_avg_scroll_depth !== null
            ? Number(r.weighted_avg_scroll_depth) * Number(r.total_pageviews)
            : 0,
        scroll_weight_denom: r.weighted_avg_scroll_depth !== null ? Number(r.total_pageviews) : 0,
        time_weighted_sum:
          r.weighted_avg_time_on_page !== null
            ? Number(r.weighted_avg_time_on_page) * Number(r.total_pageviews)
            : 0,
        time_weight_denom: r.weighted_avg_time_on_page !== null ? Number(r.total_pageviews) : 0,
        authors_published: 0, // not tracked in the archive rollup
        pv_per_published_article:
          Number(r.articles_published) > 0
            ? (Number(r.total_pageviews) - Number(r.evergreen_pageviews)) / Number(r.articles_published)
            : null,
      }));
    const combinedRows = [...(rows as any[]), ...archiveOnlyRows];

    const result: Record<
      number,
      {
        periodLabel: string;
        articlesPublished: number;
        authorsPublished: number;
        totalPageviews: number;
        evergreenPageviews: number;
        weightedAvgScrollDepth: number | null;
        weightedAvgTimeOnPage: number | null;
        pvPerPublishedArticle: number | null;
      }
    > = {};

    let divTotalPageviews = 0;
    let divPublishedPageviews = 0;
    let divArticlesPublished = 0;
    let divScrollWeightedSum = 0;
    let divScrollDenom = 0;
    let divTimeWeightedSum = 0;
    let divTimeDenom = 0;

    type DivAccum = {
      totalPageviews: number;
      publishedPageviews: number;
      articlesPublished: number;
      scrollWeightedSum: number;
      scrollDenom: number;
      timeWeightedSum: number;
      timeDenom: number;
      siteCount: number;
    };
    const byDivisionAccum = new Map<string, DivAccum>();
    const siteDivision = new Map<number, string>();

    for (const r of combinedRows) {
      siteDivision.set(r.site_id, r.division);
      const totalPageviews = Number(r.total_pageviews);
      const publishedPageviews = Number(r.published_pageviews);
      const scrollDenom = Number(r.scroll_weight_denom);
      const timeDenom = Number(r.time_weight_denom);
      result[r.site_id] = {
        periodLabel: selectedPeriodLabel,
        articlesPublished: Number(r.articles_published),
        authorsPublished: Number(r.authors_published),
        totalPageviews,
        evergreenPageviews: totalPageviews - publishedPageviews,
        weightedAvgScrollDepth: scrollDenom > 0 ? Number(r.scroll_weighted_sum) / scrollDenom : null,
        weightedAvgTimeOnPage: timeDenom > 0 ? Number(r.time_weighted_sum) / timeDenom : null,
        pvPerPublishedArticle: r.pv_per_published_article !== null ? Number(r.pv_per_published_article) : null,
      };

      divTotalPageviews += totalPageviews;
      divPublishedPageviews += publishedPageviews;
      divArticlesPublished += Number(r.articles_published);
      divScrollWeightedSum += Number(r.scroll_weighted_sum);
      divScrollDenom += scrollDenom;
      divTimeWeightedSum += Number(r.time_weighted_sum);
      divTimeDenom += timeDenom;

      const divKey = r.division as string;
      if (!byDivisionAccum.has(divKey)) {
        byDivisionAccum.set(divKey, {
          totalPageviews: 0,
          publishedPageviews: 0,
          articlesPublished: 0,
          scrollWeightedSum: 0,
          scrollDenom: 0,
          timeWeightedSum: 0,
          timeDenom: 0,
          siteCount: 0,
        });
      }
      const acc = byDivisionAccum.get(divKey)!;
      acc.totalPageviews += totalPageviews;
      acc.publishedPageviews += publishedPageviews;
      acc.articlesPublished += Number(r.articles_published);
      acc.scrollWeightedSum += Number(r.scroll_weighted_sum);
      acc.scrollDenom += scrollDenom;
      acc.timeWeightedSum += Number(r.time_weighted_sum);
      acc.timeDenom += timeDenom;
      acc.siteCount += 1;
    }

    const lastUpdatedRows = await sql`
      SELECT s.division, MAX(ti.imported_at) AS last_updated
      FROM traffic_imports ti
      JOIN sites s ON s.id = ti.site_id
      GROUP BY s.division
    `;
    const lastUpdatedByDivision = new Map<string, string>(
      (lastUpdatedRows as any[]).map((r) => [r.division, r.last_updated])
    );

    const byDivision: Record<
      string,
      {
        periodLabel: string;
        siteCount: number;
        articlesPublished: number;
        totalPageviews: number;
        evergreenPageviews: number;
        weightedAvgScrollDepth: number | null;
        weightedAvgTimeOnPage: number | null;
        pvPerPublishedArticle: number | null;
        lastUpdatedAt: string | null;
      }
    > = {};
    for (const [divKey, acc] of byDivisionAccum) {
      byDivision[divKey] = {
        periodLabel: selectedPeriodLabel,
        siteCount: acc.siteCount,
        articlesPublished: acc.articlesPublished,
        totalPageviews: acc.totalPageviews,
        evergreenPageviews: acc.totalPageviews - acc.publishedPageviews,
        weightedAvgScrollDepth: acc.scrollDenom > 0 ? acc.scrollWeightedSum / acc.scrollDenom : null,
        weightedAvgTimeOnPage: acc.timeDenom > 0 ? acc.timeWeightedSum / acc.timeDenom : null,
        pvPerPublishedArticle:
          acc.articlesPublished > 0 ? acc.publishedPageviews / acc.articlesPublished : null,
        lastUpdatedAt: lastUpdatedByDivision.get(divKey) ?? null,
      };
    }

    const divisionTotals = {
      periodLabel: selectedPeriodLabel,
      siteCount: combinedRows.length,
      articlesPublished: divArticlesPublished,
      totalPageviews: divTotalPageviews,
      evergreenPageviews: divTotalPageviews - divPublishedPageviews,
      weightedAvgScrollDepth: divScrollDenom > 0 ? divScrollWeightedSum / divScrollDenom : null,
      weightedAvgTimeOnPage: divTimeDenom > 0 ? divTimeWeightedSum / divTimeDenom : null,
      pvPerPublishedArticle:
        divArticlesPublished > 0 ? divPublishedPageviews / divArticlesPublished : null,
    };

    const filteredSites = requestedDivision
      ? Object.fromEntries(
          Object.entries(result).filter(
            ([siteId]) => siteDivision.get(Number(siteId)) === requestedDivision
          )
        )
      : result;

    return NextResponse.json({
      sites: filteredSites,
      availablePeriods,
      selectedPeriod: { key: selectedPeriodKey, label: selectedPeriodLabel },
      divisionTotals,
      byDivision,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
