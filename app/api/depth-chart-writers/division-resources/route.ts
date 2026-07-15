import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { normalizeNameKey, pickBestCasing, buildMatchNames } from "@/lib/nameNormalize";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const role = req.nextUrl.searchParams.get("role");
  if (!role) {
    return NextResponse.json({ error: "Missing role." }, { status: 400 });
  }
  const requestedPeriod = req.nextUrl.searchParams.get("period");

  try {
    const periodRows = await sql`
      SELECT DISTINCT period_key, period_label FROM traffic_imports ORDER BY period_key DESC
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

    // Every writer CARD tagged with this exact role, on whichever sites they
    // hold it — a person with this role on some sites and a different role
    // (e.g. Site Expert) elsewhere only pulls in the cards that match.
    const writerCards = await sql`
      SELECT dcw.id, dcw.site_id, dcw.name, dcw.traffic_dashboard_name, s.site_name,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM depth_chart_writers dcw
      JOIN sites s ON s.id = dcw.site_id
      LEFT JOIN writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.role = ${role} AND dcw.archived = FALSE
      GROUP BY dcw.id, s.site_name
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
      FROM article_traffic at
      JOIN traffic_imports ti ON ti.id = at.import_id
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

      return {
        name,
        siteCount: sites.length,
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
