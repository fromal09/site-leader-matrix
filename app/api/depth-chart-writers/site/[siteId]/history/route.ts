import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

const METRICS = [
  "articlesPublished",
  "totalPageviews",
  "evergreenPageviews",
  "weightedAvgScrollDepth",
  "weightedAvgTimeOnPage",
  "pvPerPublishedArticle",
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteId } = await params;
  const siteIdNum = Number(siteId);

  try {
    const rows = await sql`
      SELECT at.site_id, ti.period_key, ti.period_label,
        COUNT(*) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ti.period_key AND at.article_author IS NOT NULL
        ) AS articles_published,
        COALESCE(SUM(at.pageviews) FILTER (WHERE at.article_author IS NOT NULL), 0) AS total_pageviews,
        COALESCE(SUM(at.pageviews) FILTER (
          WHERE TO_CHAR(at.first_published_date, 'YYYY-MM') = ti.period_key AND at.article_author IS NOT NULL
        ), 0) AS published_pageviews,
        COALESCE(SUM(at.scroll_depth * at.pageviews) FILTER (
          WHERE at.scroll_depth IS NOT NULL AND at.article_author IS NOT NULL
        ), 0) AS scroll_weighted_sum,
        COALESCE(SUM(at.pageviews) FILTER (
          WHERE at.scroll_depth IS NOT NULL AND at.article_author IS NOT NULL
        ), 0) AS scroll_weight_denom,
        COALESCE(SUM(at.avg_time_on_page * at.pageviews) FILTER (
          WHERE at.avg_time_on_page IS NOT NULL AND at.article_author IS NOT NULL
        ), 0) AS time_weighted_sum,
        COALESCE(SUM(at.pageviews) FILTER (
          WHERE at.avg_time_on_page IS NOT NULL AND at.article_author IS NOT NULL
        ), 0) AS time_weight_denom,
        COALESCE(SUM(at.pageviews) FILTER (WHERE at.article_author IS NULL), 0) AS homepage_pageviews
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      GROUP BY at.site_id, ti.period_key, ti.period_label
    `;

    type Stats = {
      siteId: number;
      periodKey: string;
      periodLabel: string;
      articlesPublished: number;
      totalPageviews: number;
      evergreenPageviews: number;
      weightedAvgScrollDepth: number | null;
      weightedAvgTimeOnPage: number | null;
      pvPerPublishedArticle: number | null;
      homepagePageviews: number;
      [key: string]: any;
    };

    const bySitePeriod = new Map<string, Stats>();
    for (const r of rows as any[]) {
      const totalPageviews = Number(r.total_pageviews);
      const publishedPageviews = Number(r.published_pageviews);
      const scrollDenom = Number(r.scroll_weight_denom);
      const timeDenom = Number(r.time_weight_denom);
      const articlesPublished = Number(r.articles_published);
      const stats: Stats = {
        siteId: r.site_id,
        periodKey: r.period_key,
        periodLabel: r.period_label,
        articlesPublished,
        totalPageviews,
        evergreenPageviews: totalPageviews - publishedPageviews,
        weightedAvgScrollDepth: scrollDenom > 0 ? Number(r.scroll_weighted_sum) / scrollDenom : null,
        weightedAvgTimeOnPage: timeDenom > 0 ? Number(r.time_weighted_sum) / timeDenom : null,
        pvPerPublishedArticle: articlesPublished > 0 ? publishedPageviews / articlesPublished : null,
        homepagePageviews: Number(r.homepage_pageviews),
      };
      bySitePeriod.set(`${r.site_id}::${r.period_key}`, stats);
    }

    const byPeriod = new Map<string, Stats[]>();
    for (const s of bySitePeriod.values()) {
      if (!byPeriod.has(s.periodKey)) byPeriod.set(s.periodKey, []);
      byPeriod.get(s.periodKey)!.push(s);
    }

    const periodKeys = Array.from(byPeriod.keys()).sort();
    const history = [];
    for (const periodKey of periodKeys) {
      const siteStats = bySitePeriod.get(`${siteIdNum}::${periodKey}`);
      if (!siteStats) continue;

      const allForPeriod = byPeriod.get(periodKey)!;
      const ranks: Record<string, { rank: number; total: number } | null> = {};
      for (const metric of METRICS) {
        const entries = allForPeriod
          .map((s) => ({ siteId: s.siteId, value: s[metric] as number | null }))
          .filter((e): e is { siteId: number; value: number } => e.value !== null);
        if (entries.length === 0) {
          ranks[metric] = null;
          continue;
        }
        entries.sort((a, b) => b.value - a.value);
        const idx = entries.findIndex((e) => e.siteId === siteIdNum);
        ranks[metric] = idx === -1 ? null : { rank: idx + 1, total: entries.length };
      }

      history.push({ ...siteStats, ranks });
    }

    return NextResponse.json({ history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
