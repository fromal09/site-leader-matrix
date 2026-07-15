"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WriterCard } from "@/components/WriterCard";
import { SiteCallouts } from "@/components/SiteCallouts";
import { TeamThemeWrapper } from "@/components/TeamThemeWrapper";
import { CondensedRoster } from "@/components/CondensedRoster";
import { SiteHistoryChart } from "@/components/SiteHistoryChart";
import { HomepageHistoryChart } from "@/components/HomepageHistoryChart";
import { WriterHistoryChart } from "@/components/WriterHistoryChart";
import { useAuth } from "@/components/AuthProvider";
import { DC_BASE } from "@/lib/routes";
import { SECTIONS } from "@/lib/depthCharts";
import type { DepthChartRole, DepthChartWriter } from "@/lib/depthCharts";
import type { Site } from "@/lib/types";
import type { SiteTrafficTotals, WriterQuickStats, HomepageTraffic } from "@/lib/traffic";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import { StatTile } from "@/components/StatTile";
import { teamColor } from "@/lib/nflTeamColors";
import { rankTier, rankTierColors, rankAmong } from "@/lib/rankColor";

type AllSiteSummary = {
  articlesPublished: number;
  authorsPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  pvPerPublishedArticle: number | null;
};

function rankLabel(r: { rank: number; total: number } | null): string | undefined {
  if (!r || r.total <= 1) return undefined;
  return `#${r.rank} of ${r.total}`;
}

function rankTint(r: { rank: number; total: number } | null) {
  if (!r) return null;
  return rankTierColors(rankTier(r.rank, r.total));
}

type ViewMode = "full" | "condensed" | "historical";

export default function DepthChartSitePage() {
  const params = useParams();
  const id = Number(params.id);
  const { requireAuth } = useAuth();

  const [site, setSite] = useState<Site | null>(null);
  const [writers, setWriters] = useState<DepthChartWriter[]>([]);
  const [roles, setRoles] = useState<DepthChartRole[]>([]);
  const [quickStats, setQuickStats] = useState<Record<number, WriterQuickStats>>({});
  const [siteTotals, setSiteTotals] = useState<SiteTrafficTotals | null>(null);
  const [homepageTraffic, setHomepageTraffic] = useState<HomepageTraffic | null>(null);
  const [allSummaries, setAllSummaries] = useState<Record<number, AllSiteSummary>>({});
  const [statsPeriodLabel, setStatsPeriodLabel] = useState<string | null>(null);
  const [statsPeriodKey, setStatsPeriodKey] = useState<string | null>(null);
  const [sitePeriods, setSitePeriods] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("condensed");
  const [homepageExpanded, setHomepageExpanded] = useState(false);

  const load = useCallback(async (periodKey?: string) => {
    setLoading(true);
    const statsUrl = periodKey
      ? `/api/depth-chart-writers/site/${id}/traffic-summary?period=${encodeURIComponent(periodKey)}`
      : `/api/depth-chart-writers/site/${id}/traffic-summary`;
    const [siteRes, writersRes, rolesRes, statsRes] = await Promise.all([
      fetch(`/api/sites/${id}`).then((r) => r.json()),
      fetch(`/api/depth-chart-writers/${id}`).then((r) => r.json()),
      fetch("/api/depth-chart-roles").then((r) => r.json()),
      fetch(statsUrl).then((r) => r.json()),
    ]);
    const resolvedPeriodKey = statsRes.periodKey ?? null;
    const siteDivision = siteRes.site?.division ?? "NFL";
    const allSitesParams = new URLSearchParams({ division: siteDivision });
    if (resolvedPeriodKey) allSitesParams.set("period", resolvedPeriodKey);
    const allSitesUrl = `/api/depth-chart-writers/all-sites-summary?${allSitesParams.toString()}`;
    const allSitesRes = await fetch(allSitesUrl).then((r) => r.json());

    setSite(siteRes.site ?? null);
    setWriters(writersRes.writers ?? []);
    setRoles(rolesRes.roles ?? []);
    setQuickStats(statsRes.writers ?? {});
    setSiteTotals(statsRes.siteTotals ?? null);
    setHomepageTraffic(statsRes.homepageTraffic ?? null);
    setStatsPeriodLabel(statsRes.periodLabel ?? null);
    setStatsPeriodKey(resolvedPeriodKey);
    setSitePeriods(statsRes.availablePeriods ?? []);
    setAllSummaries(allSitesRes.sites ?? {});
    setLoading(false);
  }, [id]);

  function handlePeriodChange(key: string) {
    load(key);
  }

  useEffect(() => {
    load();
  }, [load]);

  function handleAddClick() {
    if (!requireAuth()) return;
    setAddingNew(true);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-sm text-ink-soft">Loading roster…</p>
      </main>
    );
  }

  if (!site) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-sm text-grade-low">Site not found.</p>
        <Link href={DC_BASE} className="text-sm text-navy hover:underline">
          Back to all sites
        </Link>
      </main>
    );
  }

  const hasTrafficData = Object.keys(quickStats).length > 0;
  const roleToSection = new Map(roles.map((r) => [r.label, r.section]));
  const sectioned = SECTIONS.map((s) => {
    const allInSection = writers.filter(
      (w) => (roleToSection.get(w.role) ?? "contributors") === s.key
    );
    const activeInSection = hasTrafficData
      ? allInSection.filter((w) => (quickStats[w.id]?.articlesPublished ?? 0) > 0)
      : allInSection;
    return {
      section: s,
      writers: activeInSection.sort(
        (a, b) => (quickStats[b.id]?.totalPageviews ?? 0) - (quickStats[a.id]?.totalPageviews ?? 0)
      ),
      hiddenCount: allInSection.length - activeInSection.length,
    };
  }).filter((s) => s.writers.length > 0);

  return (
    <TeamThemeWrapper siteTopic={site.site_topic}>
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href={DC_BASE} className="text-xs font-medium text-ink-soft hover:text-navy">
        ← All sites
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 font-data text-xs uppercase tracking-widest text-ink-soft">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: teamColor(site.site_topic).primary }}
            />
            {site.site_topic}
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">{site.site_name}</h1>
          <p className="text-sm text-ink-soft">Site leader: {site.leader_name}</p>
          {statsPeriodLabel && (
            <p className="mt-0.5 font-data text-xs text-ink-soft">
              Ranked by {statsPeriodLabel} pageviews
            </p>
          )}
        </div>
        {!addingNew && (
          <div className="flex flex-wrap items-center gap-2">
            {sitePeriods.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-ink-soft uppercase tracking-wide">Month</span>
                <select
                  value={statsPeriodKey ?? ""}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
                >
                  {sitePeriods.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex overflow-hidden rounded border border-navy">
              {(["condensed", "full", "historical"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-3 py-1.5 text-xs font-medium capitalize"
                  style={
                    viewMode === mode
                      ? { backgroundColor: "var(--navy)", color: "white" }
                      : { color: "var(--navy)" }
                  }
                >
                  {mode}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddClick}
              className="rounded bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-soft"
            >
              + Add Writer
            </button>
          </div>
        )}
      </div>

      {viewMode === "historical" ? (
        <div className="space-y-6">
          <SiteHistoryChart siteId={site.id} />
          <HomepageHistoryChart siteId={site.id} />
          <WriterHistoryChart writers={writers} />
        </div>
      ) : (
        <>
          {siteTotals && (
            <div className="card mb-6 rounded-md p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
                  Site Snapshot — {statsPeriodLabel}
                </h2>
                <span className="font-data text-[11px] text-ink-soft">all authors</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
                <StatTile
                  label="Published"
                  value={siteTotals.articlesPublished.toLocaleString()}
                  sub={rankLabel(rankAmong(site.id, (s: AllSiteSummary) => s.articlesPublished, allSummaries))}
                  tint={rankTint(rankAmong(site.id, (s: AllSiteSummary) => s.articlesPublished, allSummaries))}
                />
                <StatTile
                  label="Total PVs"
                  value={formatCompactNumber(siteTotals.totalPageviews)}
                  sub={rankLabel(rankAmong(site.id, (s: AllSiteSummary) => s.totalPageviews, allSummaries))}
                  tint={rankTint(rankAmong(site.id, (s: AllSiteSummary) => s.totalPageviews, allSummaries))}
                />
                <StatTile
                  label="Evergreen PVs"
                  value={formatCompactNumber(siteTotals.evergreenPageviews)}
                  sub={rankLabel(rankAmong(site.id, (s: AllSiteSummary) => s.evergreenPageviews, allSummaries))}
                  tint={rankTint(rankAmong(site.id, (s: AllSiteSummary) => s.evergreenPageviews, allSummaries))}
                />
                <StatTile
                  label="Scroll Depth"
                  value={formatPercent(siteTotals.weightedAvgScrollDepth)}
                  sub={rankLabel(rankAmong(site.id, (s: AllSiteSummary) => s.weightedAvgScrollDepth, allSummaries))}
                  tint={rankTint(rankAmong(site.id, (s: AllSiteSummary) => s.weightedAvgScrollDepth, allSummaries))}
                />
                <StatTile
                  label="Time on Page"
                  value={formatDuration(siteTotals.weightedAvgTimeOnPage)}
                  sub={rankLabel(rankAmong(site.id, (s: AllSiteSummary) => s.weightedAvgTimeOnPage, allSummaries))}
                  tint={rankTint(rankAmong(site.id, (s: AllSiteSummary) => s.weightedAvgTimeOnPage, allSummaries))}
                />
                <StatTile
                  label="PVs / New Article"
                  value={
                    siteTotals.pvPerPublishedArticle !== null
                      ? formatCompactNumber(siteTotals.pvPerPublishedArticle)
                      : "—"
                  }
                  sub={rankLabel(rankAmong(site.id, (s: AllSiteSummary) => s.pvPerPublishedArticle, allSummaries))}
                  tint={rankTint(rankAmong(site.id, (s: AllSiteSummary) => s.pvPerPublishedArticle, allSummaries))}
                />
              </div>
            </div>
          )}

          <SiteCallouts
            writers={writers}
            quickStats={quickStats}
            siteTotals={siteTotals}
            periodLabel={statsPeriodLabel}
          />

          {homepageTraffic && homepageTraffic.pageCount > 0 && (
            <div className="card mb-6 rounded-md p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
                  Homepage &amp; Site Pages
                </h2>
                <button
                  onClick={() => setHomepageExpanded((v) => !v)}
                  className="font-data text-[11px] font-medium text-navy hover:underline"
                >
                  {homepageExpanded ? "Hide pages ▲" : "View pages ▾"}
                </button>
              </div>
              <p className="mb-2 text-xs text-ink-soft">
                Pages with no author byline — homepage, tag/category pages, schedules, and similar.
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
                <StatTile label="Total PVs" value={formatCompactNumber(homepageTraffic.totalPageviews)} />
                <StatTile label="Pages" value={homepageTraffic.pageCount.toLocaleString()} />
              </div>
              {homepageExpanded && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                        <th className="py-1 pr-4">Page</th>
                        <th className="py-1 pr-4 text-right">Pageviews</th>
                        <th className="py-1 pr-4 text-right">Scroll</th>
                        <th className="py-1 text-right">Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homepageTraffic.pages.map((p, i) => (
                        <tr key={i} className="border-t border-rule">
                          <td className="max-w-md py-1.5 pr-4 text-ink">{p.article_title}</td>
                          <td className="py-1.5 pr-4 text-right font-data">
                            {p.pageviews.toLocaleString()}
                          </td>
                          <td className="py-1.5 pr-4 text-right font-data">
                            {formatPercent(p.scroll_depth)}
                          </td>
                          <td className="py-1.5 text-right font-data">
                            {formatDuration(p.avg_time_on_page)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {addingNew && (
            <div className="mb-6">
              <WriterCard
                siteId={site.id}
                writer={null}
                roles={roles}
                onRoleCreated={(r) => setRoles((prev) => [...prev, r])}
                onSaved={() => {
                  setAddingNew(false);
                  load(statsPeriodKey ?? undefined);
                }}
                onDiscardNew={() => setAddingNew(false)}
              />
            </div>
          )}

          <div className="space-y-8">
            {sectioned.map(({ section, writers: sectionWriters, hiddenCount }) => (
              <div key={section.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: section.color }}
                  />
                  <h2 className="font-display text-lg font-semibold text-navy">
                    {section.label}
                  </h2>
                  <span className="font-data text-xs text-ink-soft">
                    {sectionWriters.length}
                  </span>
                  {hiddenCount > 0 && (
                    <span className="font-data text-[11px] text-ink-soft">
                      ({hiddenCount} inactive this month hidden)
                    </span>
                  )}
                </div>
                {viewMode === "condensed" ? (
                  <CondensedRoster
                    writers={sectionWriters}
                    quickStats={quickStats}
                    sectionColor={section.color}
                  />
                ) : (
                  <div className="space-y-3">
                    {sectionWriters.map((w) => (
                      <WriterCard
                        key={w.id}
                        siteId={site.id}
                        writer={w}
                        roles={roles}
                        quickStats={quickStats[w.id]}
                        allQuickStats={quickStats}
                        siteTotals={siteTotals}
                        onRoleCreated={(r) => setRoles((prev) => [...prev, r])}
                        onSaved={() => load(statsPeriodKey ?? undefined)}
                        onDiscardNew={() => {}}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
    </TeamThemeWrapper>
  );
}
