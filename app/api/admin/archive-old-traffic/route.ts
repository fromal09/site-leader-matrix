import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const currentYearThreshold = `${new Date().getFullYear()}-01`;

  try {
    const importsToArchive = await sql`
      SELECT id, site_id, period_key, period_label, row_count
      FROM traffic_imports
      WHERE archived = FALSE AND period_key < ${currentYearThreshold}
      ORDER BY period_key ASC
    `;
    const imports = importsToArchive as any[];

    if (imports.length === 0) {
      return NextResponse.json({ ok: true, importsArchived: 0, rowsFreed: 0 });
    }

    let rowsFreed = 0;
    const archivedSummaries: { site_id: number; period_label: string }[] = [];

    for (const imp of imports) {
      const rows = await sql`
        SELECT article_author, pageviews::float8 AS pageviews,
          scroll_depth::float8 AS scroll_depth, avg_time_on_page::float8 AS avg_time_on_page,
          TO_CHAR(first_published_date, 'YYYY-MM') AS published_month
        FROM article_traffic
        WHERE import_id = ${imp.id}
      `;
      const articleRows = rows as any[];

      const authoredRows = articleRows.filter((r) => r.article_author !== null);
      const homepageRows = articleRows.filter((r) => r.article_author === null);

      const publishedRows = authoredRows.filter((r) => r.published_month === imp.period_key);
      const publishedPageviews = publishedRows.reduce((s, r) => s + r.pageviews, 0);
      const totalPageviews = authoredRows.reduce((s, r) => s + r.pageviews, 0);
      const homepagePageviews = homepageRows.reduce((s, r) => s + r.pageviews, 0);

      await sql`
        INSERT INTO site_traffic_archive
          (site_id, period_key, period_label, articles_published, total_pageviews,
           evergreen_pageviews, homepage_pageviews, weighted_avg_scroll_depth, weighted_avg_time_on_page)
        VALUES (
          ${imp.site_id}, ${imp.period_key}, ${imp.period_label},
          ${publishedRows.length}, ${totalPageviews}, ${totalPageviews - publishedPageviews},
          ${homepagePageviews},
          ${pageviewWeightedAverage(authoredRows.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews })))},
          ${pageviewWeightedAverage(authoredRows.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews })))}
        )
        ON CONFLICT (site_id, period_key) DO UPDATE SET
          articles_published = EXCLUDED.articles_published,
          total_pageviews = EXCLUDED.total_pageviews,
          evergreen_pageviews = EXCLUDED.evergreen_pageviews,
          homepage_pageviews = EXCLUDED.homepage_pageviews,
          weighted_avg_scroll_depth = EXCLUDED.weighted_avg_scroll_depth,
          weighted_avg_time_on_page = EXCLUDED.weighted_avg_time_on_page
      `;
      archivedSummaries.push({ site_id: imp.site_id, period_label: imp.period_label });

      // Writer-level rollups, matched against each writer's CURRENT name/alias
      // set (a card added after this period existed won't retroactively pick
      // up old data — an accepted tradeoff of archiving).
      const writers = await sql`
        SELECT dcw.id, dcw.name, dcw.traffic_dashboard_name,
          COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
        FROM depth_chart_writers dcw
        LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
        WHERE dcw.site_id = ${imp.site_id}
        GROUP BY dcw.id
      `;
      const byAuthor = new Map<string, any[]>();
      for (const r of authoredRows) {
        const key = String(r.article_author).trim().toLowerCase();
        if (!byAuthor.has(key)) byAuthor.set(key, []);
        byAuthor.get(key)!.push(r);
      }
      for (const w of writers as any[]) {
        const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
        const wRows = matchNames.flatMap((mn) => byAuthor.get(mn) ?? []);
        if (wRows.length === 0) continue;

        const wPublished = wRows.filter((r) => r.published_month === imp.period_key);
        const wPublishedPV = wPublished.reduce((s, r) => s + r.pageviews, 0);
        const wTotalPV = wRows.reduce((s, r) => s + r.pageviews, 0);

        await sql`
          INSERT INTO writer_traffic_archive
            (writer_id, site_id, period_key, period_label, articles_published, total_pageviews,
             weighted_avg_scroll_depth, weighted_avg_time_on_page)
          VALUES (
            ${w.id}, ${imp.site_id}, ${imp.period_key}, ${imp.period_label},
            ${wPublished.length}, ${wTotalPV},
            ${pageviewWeightedAverage(wRows.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews })))},
            ${pageviewWeightedAverage(wRows.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews })))}
          )
          ON CONFLICT (writer_id, period_key) DO UPDATE SET
            articles_published = EXCLUDED.articles_published,
            total_pageviews = EXCLUDED.total_pageviews,
            weighted_avg_scroll_depth = EXCLUDED.weighted_avg_scroll_depth,
            weighted_avg_time_on_page = EXCLUDED.weighted_avg_time_on_page
        `;
      }

      await sql`DELETE FROM article_traffic WHERE import_id = ${imp.id}`;
      await sql`UPDATE traffic_imports SET archived = TRUE WHERE id = ${imp.id}`;
      rowsFreed += articleRows.length;
    }

    return NextResponse.json({
      ok: true,
      importsArchived: imports.length,
      rowsFreed,
      summaries: archivedSummaries,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
