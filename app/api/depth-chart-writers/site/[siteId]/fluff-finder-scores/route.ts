import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { dedupeArticles, computeConcentrationScore } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

// Lightweight companion to the per-writer fluff-finder route: computes just
// the Concentration Score for every writer on this site for one period,
// without returning full per-article breakdowns — used to build the
// population range for the color-coded score box (so a given writer's
// score can be shown as "green" or "red" relative to their peers, not on
// an arbitrary fixed scale).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteId } = await params;
  const siteIdNum = Number(siteId);
  const periodKey = req.nextUrl.searchParams.get("period");
  if (!periodKey) {
    return NextResponse.json({ error: "Missing period." }, { status: 400 });
  }

  try {
    const writers = await sql`
      SELECT dcw.id, dcw.name, dcw.traffic_dashboard_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM depth_chart_writers dcw
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.site_id = ${siteIdNum} AND dcw.archived = FALSE
      GROUP BY dcw.id
    `;

    const articleRows = await sql`
      SELECT at.article_author, at.article_url, at.article_title,
        at.pageviews::float8 AS pageviews
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
      WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${periodKey}
        AND at.article_author IS NOT NULL
        AND TO_CHAR(at.first_published_date, 'YYYY-MM') = ${periodKey}
    `;
    const byAuthor = new Map<string, any[]>();
    for (const r of articleRows as any[]) {
      const key = String(r.article_author).trim().toLowerCase();
      if (!byAuthor.has(key)) byAuthor.set(key, []);
      byAuthor.get(key)!.push(r);
    }

    const scores: { writerId: number; concentrationScore: number; articlesPublished: number }[] = [];
    for (const w of writers as any[]) {
      const matchNames = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      const wRows = matchNames.flatMap((mn) => byAuthor.get(mn) ?? []);
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
