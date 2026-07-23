import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { dedupeArticles, computeConcentrationScore } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

// Division-wide version of fluff-finder-scores — same idea (Concentration
// Score only, no full article breakdown) but spanning every site in a
// division in one query, for the division-wide Fluff Finder's population
// comparison. Sites that don't have an upload for the requested period
// are simply excluded from the population rather than erroring.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const division = req.nextUrl.searchParams.get("division");
  const periodKey = req.nextUrl.searchParams.get("period");
  if (!division || !periodKey) {
    return NextResponse.json({ error: "Missing division or period." }, { status: 400 });
  }

  try {
    const writers = await sql`
      SELECT dcw.id, dcw.site_id, dcw.name, dcw.traffic_dashboard_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM depth_chart_writers dcw
      JOIN sites s ON s.id = dcw.site_id
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      WHERE s.division = ${division} AND dcw.archived = FALSE
      GROUP BY dcw.id
    `;
    const siteIds = Array.from(new Set((writers as any[]).map((w) => w.site_id)));
    if (siteIds.length === 0) {
      return NextResponse.json({ periodKey, scores: [] });
    }

    const articleRows = await sql`
      SELECT at.site_id, at.article_author, at.article_url, at.article_title,
        at.pageviews::float8 AS pageviews
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ANY(${siteIds}::int[]) AND ti.period_key = ${periodKey}
        AND at.article_author IS NOT NULL
        AND TO_CHAR(at.first_published_date, 'YYYY-MM') = ${periodKey}
    `;
    const bySiteAuthor = new Map<string, any[]>();
    for (const r of articleRows as any[]) {
      const key = `${r.site_id}::${String(r.article_author).trim().toLowerCase()}`;
      if (!bySiteAuthor.has(key)) bySiteAuthor.set(key, []);
      bySiteAuthor.get(key)!.push(r);
    }

    const scores: { writerId: number; concentrationScore: number; articlesPublished: number }[] = [];
    for (const w of writers as any[]) {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const wRows = matchNames.flatMap((mn) => bySiteAuthor.get(`${w.site_id}::${mn}`) ?? []);
      if (wRows.length === 0) continue;
      const deduped = dedupeArticles(wRows).sort((a, b) => b.pageviews - a.pageviews);
      scores.push({
        writerId: w.id,
        concentrationScore: computeConcentrationScore(deduped),
        articlesPublished: deduped.length,
      });
    }

    return NextResponse.json({ periodKey, scores });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
