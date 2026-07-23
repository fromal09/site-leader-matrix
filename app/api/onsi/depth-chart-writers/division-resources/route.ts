import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { normalizeNameKey, pickBestCasing, buildMatchNames } from "@/lib/nameNormalize";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // Accepts either ?role=X (legacy, single) or ?roles=X,Y (multi). At least
  // one role is required. Division is OPTIONAL: provide it to scope to one
  // division (e.g. the Division Resources page), or omit it entirely to
  // aggregate a person's work across every division they touch (the
  // Network Writers and FTE pages).
  const rolesParam = req.nextUrl.searchParams.get("roles") ?? req.nextUrl.searchParams.get("role");
  if (!rolesParam) {
    return NextResponse.json({ error: "Missing role(s)." }, { status: 400 });
  }
  const roles = rolesParam.split(",").map((r) => r.trim()).filter(Boolean);
  const division = req.nextUrl.searchParams.get("division"); // null = all divisions
  const requestedPeriod = req.nextUrl.searchParams.get("period");

  try {
    const periodRows = division
      ? await sql`
          SELECT DISTINCT ti.period_key, ti.period_label
          FROM onsi_traffic_imports ti
          JOIN onsi_sites s ON s.id = ti.site_id
          WHERE s.division = ${division}
          ORDER BY ti.period_key DESC
        `
      : await sql`
          SELECT DISTINCT period_key, period_label FROM onsi_traffic_imports ORDER BY period_key DESC
        `;
    const periods = periodRows as any[];
    if (periods.length === 0) {
      return NextResponse.json({ writers: [], selectedPeriod: null });
    }
    const selectedPeriodKey =
      requestedPeriod && periods.some((p) => p.period_key === requestedPeriod)
        ? requestedPeriod
        : periods[0].period_key;
    const selectedPeriodLabel =
      periods.find((p) => p.period_key === selectedPeriodKey)?.period_label ?? selectedPeriodKey;

    // Every writer CARD tagged with one of these roles, on whichever sites
    // they hold it — a person with this role on some sites and a different
    // role elsewhere only pulls in the cards that match.
    const writerCards = division
      ? await sql`
          SELECT dcw.id, dcw.site_id, dcw.name, dcw.role, dcw.traffic_dashboard_name,
            s.site_name, s.division,
            COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
          FROM onsi_depth_chart_writers dcw
          JOIN onsi_sites s ON s.id = dcw.site_id
          LEFT JOIN onsi_writer_aliases wa ON wa.writer_id = dcw.id
          WHERE dcw.role = ANY(${roles}::text[]) AND dcw.archived = FALSE AND s.division = ${division}
          GROUP BY dcw.id, s.site_name, s.division
        `
      : await sql`
          SELECT dcw.id, dcw.site_id, dcw.name, dcw.role, dcw.traffic_dashboard_name,
            s.site_name, s.division,
            COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
          FROM onsi_depth_chart_writers dcw
          JOIN onsi_sites s ON s.id = dcw.site_id
          LEFT JOIN onsi_writer_aliases wa ON wa.writer_id = dcw.id
          WHERE dcw.role = ANY(${roles}::text[]) AND dcw.archived = FALSE
          GROUP BY dcw.id, s.site_name, s.division
        `;
    const cards = writerCards as any[];
    if (cards.length === 0) {
      return NextResponse.json({
        writers: [],
        selectedPeriod: { key: selectedPeriodKey, label: selectedPeriodLabel },
      });
    }

    const siteIds = Array.from(new Set(cards.map((c) => c.site_id)));
    const articleRows = await sql`
      SELECT at.site_id, at.article_author, at.pageviews::float8 AS pageviews,
        at.scroll_depth::float8 AS scroll_depth, at.avg_time_on_page::float8 AS avg_time_on_page,
        TO_CHAR(at.first_published_date, 'YYYY-MM') AS published_month
      FROM onsi_article_traffic at
      JOIN onsi_traffic_imports ti ON ti.id = at.import_id
      WHERE ti.period_key = ${selectedPeriodKey}
        AND at.site_id = ANY(${siteIds}::int[])
        AND at.article_author IS NOT NULL
    `;
    const bySiteAuthor = new Map<string, any[]>();
    for (const r of articleRows as any[]) {
      const key = `${r.site_id}::${String(r.article_author).trim().toLowerCase()}`;
      if (!bySiteAuthor.has(key)) bySiteAuthor.set(key, []);
      bySiteAuthor.get(key)!.push(r);
    }

    type SiteBreakdown = {
      siteId: number;
      siteName: string;
      division: string;
      role: string;
      articlesPublished: number;
      totalPageviews: number;
      pvPerPublishedArticle: number | null;
      weightedAvgScrollDepth: number | null;
      weightedAvgTimeOnPage: number | null;
    };

    const byName = new Map<string, { variants: Set<string>; sites: SiteBreakdown[] }>();

    for (const card of cards) {
      const matchNames = buildMatchNames(card.name, card.traffic_dashboard_name, card.aliases);
      if (matchNames.length === 0) continue;
      const rows = matchNames.flatMap((mn) => bySiteAuthor.get(`${card.site_id}::${mn}`) ?? []);
      if (rows.length === 0) continue;

      const publishedRows = rows.filter((r) => r.published_month === selectedPeriodKey);
      const publishedPageviews = publishedRows.reduce((sum, r) => sum + r.pageviews, 0);
      const totalPageviews = rows.reduce((sum, r) => sum + r.pageviews, 0);

      const breakdown: SiteBreakdown = {
        siteId: card.site_id,
        siteName: card.site_name,
        division: card.division,
        role: card.role,
        articlesPublished: publishedRows.length,
        totalPageviews,
        pvPerPublishedArticle:
          publishedRows.length > 0 ? publishedPageviews / publishedRows.length : null,
        weightedAvgScrollDepth: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
        ),
        weightedAvgTimeOnPage: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
        ),
      };

      const key = normalizeNameKey(card.name);
      if (!byName.has(key)) byName.set(key, { variants: new Set(), sites: [] });
      const group = byName.get(key)!;
      group.variants.add(card.name.trim());
      // If duplicate cards exist for the same person on the same site (e.g.
      // leftover casing-variant cards), don't double-count that site.
      if (!group.sites.some((s) => s.siteId === card.site_id)) {
        group.sites.push(breakdown);
      }
    }

    const writers = Array.from(byName.values()).map(({ variants, sites }) => {
      const name = pickBestCasing(Array.from(variants));
      const articlesPublished = sites.reduce((s, x) => s + x.articlesPublished, 0);
      const totalPageviews = sites.reduce((s, x) => s + x.totalPageviews, 0);
      const publishedPageviews = sites.reduce(
        (s, x) => s + (x.pvPerPublishedArticle ?? 0) * x.articlesPublished,
        0
      );
      // Re-weight scroll/time across sites using each site's own pageviews.
      const scrollInputs = sites
        .filter((x) => x.weightedAvgScrollDepth !== null)
        .map((x) => ({ value: x.weightedAvgScrollDepth, pageviews: x.totalPageviews }));
      const timeInputs = sites
        .filter((x) => x.weightedAvgTimeOnPage !== null)
        .map((x) => ({ value: x.weightedAvgTimeOnPage, pageviews: x.totalPageviews }));

      const divisions = Array.from(new Set(sites.map((s) => s.division))).sort();

      return {
        name,
        siteCount: sites.length,
        divisions,
        articlesPublished,
        totalPageviews,
        pvPerPublishedArticle: articlesPublished > 0 ? publishedPageviews / articlesPublished : null,
        weightedAvgScrollDepth: pageviewWeightedAverage(scrollInputs),
        weightedAvgTimeOnPage: pageviewWeightedAverage(timeInputs),
        sites: sites.sort((a, b) => b.totalPageviews - a.totalPageviews),
      };
    });

    writers.sort((a, b) => b.totalPageviews - a.totalPageviews);

    return NextResponse.json({
      writers,
      selectedPeriod: { key: selectedPeriodKey, label: selectedPeriodLabel },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
