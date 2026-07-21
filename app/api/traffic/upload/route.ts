import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { ParsedTrafficRow } from "@/lib/traffic";
import { pageviewWeightedAverage, dedupeArticles, articleKey } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

export const maxDuration = 60;

const CHUNK_SIZE = 2000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { siteId, hostname, periodKey, periodLabel, rows } = await req.json();

  if (!siteId || !periodKey || !periodLabel) {
    return NextResponse.json({ error: "Missing site or period." }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }

  const siteIdNum = Number(siteId);

  try {
    if (hostname) {
      await sql`
        UPDATE sites SET hostname = ${hostname}
        WHERE id = ${siteIdNum} AND (hostname IS NULL OR hostname <> ${hostname})
      `;
    }

    // Replace semantics: re-uploading the same site+month overwrites what's there.
    const existing = await sql`
      SELECT id FROM traffic_imports WHERE site_id = ${siteIdNum} AND period_key = ${periodKey}
    `;
    let importId: number;
    if ((existing as any[])[0]) {
      importId = (existing as any[])[0].id;

      // Snapshot what's about to be overwritten — this is what makes
      // "current vs. previous upload" deltas possible later, since the
      // detailed rows themselves are about to be deleted.
      const outgoingRows = await sql`
        SELECT article_author, article_url, article_title, pageviews::float8 AS pageviews,
          scroll_depth::float8 AS scroll_depth, avg_time_on_page::float8 AS avg_time_on_page,
          TO_CHAR(first_published_date, 'YYYY-MM') AS published_month
        FROM article_traffic WHERE import_id = ${importId}
      `;
      const outgoing = outgoingRows as any[];
      if (outgoing.length > 0) {
        const authored = outgoing.filter((r) => r.article_author !== null);
        const homepage = outgoing.filter((r) => r.article_author === null);
        const published = dedupeArticles(authored.filter((r) => r.published_month === periodKey));
        const publishedPv = published.reduce((s, r) => s + r.pageviews, 0);
        const totalPv = authored.reduce((s, r) => s + r.pageviews, 0);
        const homepagePv = homepage.reduce((s, r) => s + r.pageviews, 0);

        await sql`
          INSERT INTO site_traffic_snapshots
            (site_id, period_key, period_label, articles_published, total_pageviews, published_pageviews,
             evergreen_pageviews, homepage_pageviews, weighted_avg_scroll_depth, weighted_avg_time_on_page)
          VALUES (
            ${siteIdNum}, ${periodKey}, ${periodLabel},
            ${published.length}, ${totalPv}, ${publishedPv}, ${totalPv - publishedPv}, ${homepagePv},
            ${pageviewWeightedAverage(published.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews })))},
            ${pageviewWeightedAverage(published.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews })))}
          )
        `;

        const writers = await sql`
          SELECT dcw.id, dcw.name, dcw.traffic_dashboard_name,
            COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
          FROM depth_chart_writers dcw
          LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
          WHERE dcw.site_id = ${siteIdNum}
          GROUP BY dcw.id
        `;
        const byAuthor = new Map<string, any[]>();
        for (const r of authored) {
          const key = String(r.article_author).trim().toLowerCase();
          if (!byAuthor.has(key)) byAuthor.set(key, []);
          byAuthor.get(key)!.push(r);
        }
        for (const w of writers as any[]) {
          const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
          const wRows = matchNames.flatMap((mn) => byAuthor.get(mn) ?? []);
          if (wRows.length === 0) continue;
          const wPublished = dedupeArticles(wRows.filter((r) => r.published_month === periodKey));
          const wPublishedPv = wPublished.reduce((s, r) => s + r.pageviews, 0);
          const wTotalPv = wRows.reduce((s, r) => s + r.pageviews, 0);
          await sql`
            INSERT INTO writer_traffic_snapshots
              (writer_id, site_id, period_key, articles_published, total_pageviews, published_pageviews,
               weighted_avg_scroll_depth, weighted_avg_time_on_page)
            VALUES (
              ${w.id}, ${siteIdNum}, ${periodKey}, ${wPublished.length}, ${wTotalPv}, ${wPublishedPv},
              ${pageviewWeightedAverage(wPublished.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews })))},
              ${pageviewWeightedAverage(wPublished.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews })))}
            )
          `;
        }

        // True day-over-day deltas: match every individual OLD (about to be
        // replaced) article against its counterpart in the NEW incoming
        // data by URL/title, across ALL authored content — not just
        // articles published this period. A matched article contributes
        // (new - old); an article with no old counterpart is brand new, so
        // its entire value counts. This is the only point where both the
        // outgoing and incoming states exist at once, so it's the only
        // place this can be computed correctly — aggregate-only snapshots
        // can't be diffed after the fact to recover this.
        const oldByKey = new Map<string, any>();
        for (const r of dedupeArticles(authored)) {
          oldByKey.set(articleKey(r.article_url, r.article_title, oldByKey.size), r);
        }
        const newAuthoredNormalized = (rows as ParsedTrafficRow[])
          .filter((r) => r.author && r.author.trim())
          .map((r) => ({
            article_url: r.url,
            article_title: r.title,
            article_author: r.author,
            pageviews: r.pageviews,
            scroll_depth: r.scrollDepth,
            avg_time_on_page: r.avgTimeOnPage,
          }));
        const newByKey = new Map<string, (typeof newAuthoredNormalized)[number]>();
        for (const r of dedupeArticles(newAuthoredNormalized)) {
          newByKey.set(articleKey(r.article_url, r.article_title, newByKey.size), r);
        }

        type ArticleDelta = { author: string; pvDelta: number; scrollWeightedSumDelta: number; timeWeightedSumDelta: number };
        const perArticleDeltas: ArticleDelta[] = [];
        for (const [key, newRow] of newByKey) {
          const oldRow = oldByKey.get(key);
          const oldPv = oldRow ? oldRow.pageviews : 0;
          const oldScrollSum = oldRow && oldRow.scroll_depth !== null ? oldRow.scroll_depth * oldRow.pageviews : 0;
          const oldTimeSum = oldRow && oldRow.avg_time_on_page !== null ? oldRow.avg_time_on_page * oldRow.pageviews : 0;
          const newScrollSum = newRow.scroll_depth !== null ? newRow.scroll_depth * newRow.pageviews : 0;
          const newTimeSum = newRow.avg_time_on_page !== null ? newRow.avg_time_on_page * newRow.pageviews : 0;

          const pvDelta = newRow.pageviews - oldPv;
          // Cumulative data should only grow; skip the rare case of a
          // decrease (a data revision, not "negative traffic") rather than
          // let it pull the aggregate down artificially.
          if (pvDelta <= 0) continue;
          perArticleDeltas.push({
            author: newRow.article_author as string,
            pvDelta,
            scrollWeightedSumDelta: newScrollSum - oldScrollSum,
            timeWeightedSumDelta: newTimeSum - oldTimeSum,
          });
        }

        const sitePvDelta = perArticleDeltas.reduce((s, d) => s + d.pvDelta, 0);
        const siteScrollWeightedSumDelta = perArticleDeltas.reduce((s, d) => s + d.scrollWeightedSumDelta, 0);
        const siteTimeWeightedSumDelta = perArticleDeltas.reduce((s, d) => s + d.timeWeightedSumDelta, 0);
        await sql`
          INSERT INTO site_daily_deltas (site_id, period_key, pv_delta, scroll_weighted_sum_delta, time_weighted_sum_delta)
          VALUES (${siteIdNum}, ${periodKey}, ${sitePvDelta}, ${siteScrollWeightedSumDelta}, ${siteTimeWeightedSumDelta})
        `;

        const deltasByAuthor = new Map<string, ArticleDelta[]>();
        for (const d of perArticleDeltas) {
          const key = d.author.trim().toLowerCase();
          if (!deltasByAuthor.has(key)) deltasByAuthor.set(key, []);
          deltasByAuthor.get(key)!.push(d);
        }
        for (const w of writers as any[]) {
          const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
          const wDeltas = matchNames.flatMap((mn) => deltasByAuthor.get(mn) ?? []);
          if (wDeltas.length === 0) continue;
          const wPvDelta = wDeltas.reduce((s, d) => s + d.pvDelta, 0);
          const wScrollWeightedSumDelta = wDeltas.reduce((s, d) => s + d.scrollWeightedSumDelta, 0);
          const wTimeWeightedSumDelta = wDeltas.reduce((s, d) => s + d.timeWeightedSumDelta, 0);
          await sql`
            INSERT INTO writer_daily_deltas
              (writer_id, site_id, period_key, pv_delta, scroll_weighted_sum_delta, time_weighted_sum_delta)
            VALUES (${w.id}, ${siteIdNum}, ${periodKey}, ${wPvDelta}, ${wScrollWeightedSumDelta}, ${wTimeWeightedSumDelta})
          `;
        }
      }

      await sql`DELETE FROM article_traffic WHERE import_id = ${importId}`;
      await sql`
        UPDATE traffic_imports
        SET period_label = ${periodLabel}, row_count = ${rows.length},
            imported_by = ${session.name}, imported_at = now()
        WHERE id = ${importId}
      `;
    } else {
      const inserted = await sql`
        INSERT INTO traffic_imports (site_id, period_key, period_label, row_count, imported_by)
        VALUES (${siteIdNum}, ${periodKey}, ${periodLabel}, ${rows.length}, ${session.name})
        RETURNING id
      `;
      importId = (inserted as any[])[0].id;
    }

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk: ParsedTrafficRow[] = rows.slice(i, i + CHUNK_SIZE);
      const titles = chunk.map((r) => r.title);
      const authors = chunk.map((r) => r.author);
      const urls = chunk.map((r) => r.url);
      const dates = chunk.map((r) => r.firstPublishedDate);
      const pageviews = chunk.map((r) => r.pageviews);
      const scrollDepths = chunk.map((r) => r.scrollDepth);
      const avgTimes = chunk.map((r) => r.avgTimeOnPage);

      await sql`
        INSERT INTO article_traffic
          (import_id, site_id, article_title, article_author, article_url, first_published_date, pageviews, scroll_depth, avg_time_on_page)
        SELECT ${importId}, ${siteIdNum}, t, a, u, d::date, p, sd, at
        FROM UNNEST(
          ${titles}::text[],
          ${authors}::text[],
          ${urls}::text[],
          ${dates}::text[],
          ${pageviews}::int[],
          ${scrollDepths}::numeric[],
          ${avgTimes}::numeric[]
        ) AS unnested(t, a, u, d, p, sd, at)
      `;
    }

    return NextResponse.json({ ok: true, importId, rowCount: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
