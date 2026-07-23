import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildMatchNames } from "@/lib/nameNormalize";

// Network-wide version of the per-site "Check for New Authors" check —
// one bulk pass instead of visiting every site's roster page individually.
// For each site, looks at its most recent uploaded period, finds every
// distinct byline with traffic, and flags the ones that don't match any
// existing writer card (or an ignored-author entry) for that site.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const divisionFilter = req.nextUrl.searchParams.get("division");

  try {
    const [candidateRows, writerRows, ignoredRows] = await Promise.all([
      sql`
        WITH latest_periods AS (
          SELECT DISTINCT ON (site_id) site_id, period_key
          FROM onsi_traffic_imports
          ORDER BY site_id, period_key DESC
        )
        SELECT at.site_id, s.site_name, s.division, at.article_author AS author,
          COUNT(*)::int AS articles, SUM(at.pageviews)::bigint AS pageviews
        FROM onsi_article_traffic at
        JOIN onsi_traffic_imports ti ON ti.id = at.import_id
        JOIN latest_periods lp ON lp.site_id = at.site_id AND lp.period_key = ti.period_key
        JOIN onsi_sites s ON s.id = at.site_id
        WHERE at.article_author IS NOT NULL
        GROUP BY at.site_id, s.site_name, s.division, at.article_author
        ORDER BY s.site_name ASC, pageviews DESC
      `,
      sql`
        SELECT dcw.id, dcw.site_id, dcw.name, dcw.traffic_dashboard_name,
          COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
        FROM onsi_depth_chart_writers dcw
        LEFT JOIN onsi_writer_aliases wa ON wa.writer_id = dcw.id
        WHERE dcw.archived = FALSE
        GROUP BY dcw.id
      `,
      sql`SELECT site_id, author_name FROM onsi_ignored_traffic_authors`,
    ]);

    const matchNamesBySite = new Map<number, Set<string>>();
    for (const w of writerRows as any[]) {
      const names = buildMatchNames(w.name, w.traffic_dashboard_name, w.aliases);
      if (!matchNamesBySite.has(w.site_id)) matchNamesBySite.set(w.site_id, new Set());
      for (const n of names) matchNamesBySite.get(w.site_id)!.add(n);
    }

    const ignoredBySite = new Map<number, Set<string>>();
    for (const r of ignoredRows as any[]) {
      const key = r.author_name.trim().toLowerCase();
      if (!ignoredBySite.has(r.site_id)) ignoredBySite.set(r.site_id, new Set());
      ignoredBySite.get(r.site_id)!.add(key);
    }

    const bySite = new Map<
      number,
      { siteId: number; siteName: string; division: string; authors: { name: string; articles: number; pageviews: number }[] }
    >();
    for (const r of candidateRows as any[]) {
      if (divisionFilter && r.division !== divisionFilter) continue;
      const key = String(r.author).trim().toLowerCase();
      const known = matchNamesBySite.get(r.site_id) ?? new Set();
      const ignored = ignoredBySite.get(r.site_id) ?? new Set();
      if (known.has(key) || ignored.has(key)) continue;

      if (!bySite.has(r.site_id)) {
        bySite.set(r.site_id, { siteId: r.site_id, siteName: r.site_name, division: r.division, authors: [] });
      }
      bySite.get(r.site_id)!.authors.push({
        name: r.author,
        articles: r.articles,
        pageviews: Number(r.pageviews),
      });
    }

    const sites = Array.from(bySite.values()).sort((a, b) => a.siteName.localeCompare(b.siteName));
    const totalAuthors = sites.reduce((sum, s) => sum + s.authors.length, 0);

    return NextResponse.json({ sites, siteCount: sites.length, totalAuthors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
