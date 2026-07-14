import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const requestedPeriod = req.nextUrl.searchParams.get("period");

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
        COUNT(*) FILTER (
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
        ), 0)::float8 / NULLIF(COUNT(*) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ${selectedPeriodKey}
        ), 0) AS pv_per_published_article
      FROM article_traffic at
      JOIN matching_imports mi ON mi.id = at.import_id
      WHERE at.article_author IS NOT NULL
      GROUP BY mi.site_id
    `;

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

    for (const r of rows as any[]) {
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
    }

    const divisionTotals = {
      periodLabel: selectedPeriodLabel,
      siteCount: rows.length,
      articlesPublished: divArticlesPublished,
      totalPageviews: divTotalPageviews,
      evergreenPageviews: divTotalPageviews - divPublishedPageviews,
      weightedAvgScrollDepth: divScrollDenom > 0 ? divScrollWeightedSum / divScrollDenom : null,
      weightedAvgTimeOnPage: divTimeDenom > 0 ? divTimeWeightedSum / divTimeDenom : null,
      pvPerPublishedArticle:
        divArticlesPublished > 0 ? divPublishedPageviews / divArticlesPublished : null,
    };

    return NextResponse.json({
      sites: result,
      availablePeriods,
      selectedPeriod: { key: selectedPeriodKey, label: selectedPeriodLabel },
      divisionTotals,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
