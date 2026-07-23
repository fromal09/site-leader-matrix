import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { dedupeArticles } from "@/lib/trafficStats";
import { buildMatchNames } from "@/lib/nameNormalize";

// For a given writer, ranks their current-period articles by pageviews and
// computes the running share of their total traffic captured through each
// article — the data behind "Fluff Finder": at what point does adding one
// more article stop meaningfully moving the needle.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteId } = await params;
  const siteIdNum = Number(siteId);
  const writerId = req.nextUrl.searchParams.get("writerId");
  const requestedPeriod = req.nextUrl.searchParams.get("period");
  if (!writerId) {
    return NextResponse.json({ error: "Missing writerId." }, { status: 400 });
  }

  try {
    const writerRows = await sql`
      SELECT dcw.id, dcw.name, dcw.traffic_dashboard_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM onsi_depth_chart_writers dcw
      LEFT JOIN onsi_writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.id = ${Number(writerId)} AND dcw.site_id = ${siteIdNum}
      GROUP BY dcw.id
    `;
    const writer = (writerRows as any[])[0];
    if (!writer) {
      return NextResponse.json({ error: "Writer not found on this site." }, { status: 404 });
    }

    const allPeriodRows = await sql`
      SELECT DISTINCT period_key, period_label FROM onsi_traffic_imports
      WHERE site_id = ${siteIdNum}
      ORDER BY period_key DESC
    `;
    const availablePeriods = (allPeriodRows as any[]).map((r) => ({
      key: r.period_key,
      label: r.period_label,
    }));

    const periodKey =
      requestedPeriod && availablePeriods.some((p) => p.key === requestedPeriod)
        ? requestedPeriod
        : availablePeriods[0]?.key ?? null;
    if (!periodKey) {
      return NextResponse.json({
        writerId: writer.id,
        writerName: writer.name,
        periodKey: null,
        periodLabel: null,
        availablePeriods,
        articles: [],
        totalPageviews: 0,
      });
    }
    const periodLabel = availablePeriods.find((p) => p.key === periodKey)?.label ?? periodKey;

    const matchNames = buildMatchNames(writer.name, writer.traffic_dashboard_name, writer.aliases);
    const rows =
      matchNames.length > 0
        ? await sql`
            SELECT at.article_title, at.article_url, at.pageviews::float8 AS pageviews,
              at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page
            FROM onsi_article_traffic at
            JOIN onsi_traffic_imports ti ON ti.id = at.import_id
            WHERE at.site_id = ${siteIdNum} AND ti.period_key = ${periodKey}
              AND LOWER(TRIM(at.article_author)) = ANY(${matchNames}::text[])
              AND TO_CHAR(at.first_published_date, 'YYYY-MM') = ${periodKey}
          `
        : [];

    const published = dedupeArticles(rows as any[]).sort((a, b) => b.pageviews - a.pageviews);
    const totalPageviews = published.reduce((s, r) => s + r.pageviews, 0);
    const totalArticles = published.length;
    let running = 0;
    const articles = published.map((r, i) => {
      running += r.pageviews;
      return {
        rank: i + 1,
        title: r.article_title,
        url: r.article_url,
        pageviews: r.pageviews,
        cumulativePageviews: running,
        cumulativePct: totalPageviews > 0 ? running / totalPageviews : 0,
        // "At article 45 of 100, that's 45% of this writer's article
        // volume" — compared against cumulativePct ("...but 82% of their
        // traffic"), this is the efficiency read: how much traffic is
        // concentrated in how little of the output.
        cumulativeArticlePct: totalArticles > 0 ? (i + 1) / totalArticles : 0,
      };
    });

    return NextResponse.json({
      writerId: writer.id,
      writerName: writer.name,
      periodKey,
      periodLabel,
      availablePeriods,
      totalPageviews,
      articles,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
