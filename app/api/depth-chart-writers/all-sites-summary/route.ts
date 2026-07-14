import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    // Aggregated in SQL (not fetched row-by-row to JS) so this stays fast
    // regardless of how many articles are on file across all sites.
    const rows = await sql`
      WITH latest AS (
        SELECT site_id, MAX(period_key) AS period_key
        FROM traffic_imports
        GROUP BY site_id
      ),
      latest_import AS (
        SELECT ti.id, ti.site_id, ti.period_key, ti.period_label
        FROM traffic_imports ti
        JOIN latest l ON l.site_id = ti.site_id AND l.period_key = ti.period_key
      )
      SELECT
        li.site_id,
        li.period_label,
        COUNT(*) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = li.period_key
        ) AS articles_published,
        COALESCE(SUM(at.pageviews), 0) AS total_pageviews,
        COALESCE(SUM(at.pageviews) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = li.period_key
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
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = li.period_key
        ) AS authors_published
      FROM article_traffic at
      JOIN latest_import li ON li.id = at.import_id
      WHERE at.article_author IS NOT NULL
      GROUP BY li.site_id, li.period_label
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
      }
    > = {};

    for (const r of rows as any[]) {
      const totalPageviews = Number(r.total_pageviews);
      const publishedPageviews = Number(r.published_pageviews);
      const scrollDenom = Number(r.scroll_weight_denom);
      const timeDenom = Number(r.time_weight_denom);
      result[r.site_id] = {
        periodLabel: r.period_label,
        articlesPublished: Number(r.articles_published),
        authorsPublished: Number(r.authors_published),
        totalPageviews,
        evergreenPageviews: totalPageviews - publishedPageviews,
        weightedAvgScrollDepth: scrollDenom > 0 ? Number(r.scroll_weighted_sum) / scrollDenom : null,
        weightedAvgTimeOnPage: timeDenom > 0 ? Number(r.time_weighted_sum) / timeDenom : null,
      };
    }

    return NextResponse.json({ sites: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
