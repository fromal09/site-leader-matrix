import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("writerIds");
  if (!idsParam) {
    return NextResponse.json({ writers: [] });
  }
  const writerIds = Array.from(
    new Set(
      idsParam
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n))
    )
  ).slice(0, 3);
  if (writerIds.length === 0) {
    return NextResponse.json({ writers: [] });
  }

  try {
    const writerRows = await sql`
      SELECT dcw.id, dcw.site_id, dcw.name, dcw.traffic_dashboard_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM depth_chart_writers dcw
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.id = ANY(${writerIds}::int[])
      GROUP BY dcw.id
    `;
    const writers = writerRows as any[];
    if (writers.length === 0) return NextResponse.json({ writers: [] });

    const siteIds = Array.from(new Set(writers.map((w) => w.site_id)));
    const articleRows = await sql`
      SELECT at.site_id, at.article_author, at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month,
        ti.period_key, ti.period_label
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ANY(${siteIds}::int[]) AND at.article_author IS NOT NULL
    `;
    const rows = articleRows as any[];

    const bySiteAuthorPeriod = new Map<string, any[]>();
    for (const r of rows) {
      const key = `${r.site_id}::${String(r.article_author).trim().toLowerCase()}::${r.period_key}`;
      if (!bySiteAuthorPeriod.has(key)) bySiteAuthorPeriod.set(key, []);
      bySiteAuthorPeriod.get(key)!.push(r);
    }

    const result = writers.map((w) => {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const periodsForSite = Array.from(
        new Set(rows.filter((r) => r.site_id === w.site_id).map((r) => r.period_key))
      ).sort();

      const history = [];
      for (const periodKey of periodsForSite) {
        const wrows = matchNames.flatMap(
          (mn) => bySiteAuthorPeriod.get(`${w.site_id}::${mn}::${periodKey}`) ?? []
        );
        if (wrows.length === 0) continue;

        const publishedRows = wrows.filter((r) => r.published_month === periodKey);
        const publishedPageviews = publishedRows.reduce((s, r) => s + r.pageviews, 0);
        const totalPageviews = wrows.reduce((s, r) => s + r.pageviews, 0);

        history.push({
          periodKey,
          periodLabel: wrows[0].period_label,
          articlesPublished: publishedRows.length,
          totalPageviews,
          evergreenPageviews: totalPageviews - publishedPageviews,
          pvPerPublishedArticle:
            publishedRows.length > 0 ? publishedPageviews / publishedRows.length : null,
          weightedAvgScrollDepth: pageviewWeightedAverage(
            wrows.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
          ),
          weightedAvgTimeOnPage: pageviewWeightedAverage(
            wrows.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
          ),
        });
      }

      return { writerId: w.id, name: w.name, history };
    });

    // Merge in archived (pre-current-year, raw-data-pruned) periods.
    const archiveRows = await sql`
      SELECT * FROM writer_traffic_archive WHERE writer_id = ANY(${writerIds}::int[])
    `;
    const archiveByWriter = new Map<number, any[]>();
    for (const r of archiveRows as any[]) {
      if (!archiveByWriter.has(r.writer_id)) archiveByWriter.set(r.writer_id, []);
      archiveByWriter.get(r.writer_id)!.push(r);
    }
    for (const w of result) {
      const archived = archiveByWriter.get(w.writerId) ?? [];
      const existingKeys = new Set(w.history.map((h) => h.periodKey));
      for (const r of archived) {
        if (existingKeys.has(r.period_key)) continue; // live data takes precedence
        w.history.push({
          periodKey: r.period_key,
          periodLabel: r.period_label,
          articlesPublished: r.articles_published,
          totalPageviews: Number(r.total_pageviews),
          evergreenPageviews: Number(r.total_pageviews) - 0, // archive doesn't split evergreen at writer level
          pvPerPublishedArticle:
            r.articles_published > 0 ? Number(r.total_pageviews) / r.articles_published : null,
          weightedAvgScrollDepth:
            r.weighted_avg_scroll_depth !== null ? Number(r.weighted_avg_scroll_depth) : null,
          weightedAvgTimeOnPage:
            r.weighted_avg_time_on_page !== null ? Number(r.weighted_avg_time_on_page) : null,
        });
      }
      w.history.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    }

    return NextResponse.json({ writers: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
