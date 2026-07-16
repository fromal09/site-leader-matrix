"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { dcSiteHref } from "@/lib/routes";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import { teamColor } from "@/lib/nflTeamColors";
import { WriterLeaderboard } from "@/components/WriterLeaderboard";
import { StatTile } from "@/components/StatTile";
import { DIVISIONS } from "@/lib/divisions";
import { rankAmong } from "@/lib/rankColor";
import { HighlightValue } from "@/components/HighlightValue";
import type { Site } from "@/lib/types";

type SiteSummary = {
  periodLabel: string;
  articlesPublished: number;
  authorsPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  pvPerPublishedArticle: number | null;
};

type DivisionTotals = {
  periodLabel: string;
  siteCount: number;
  articlesPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  pvPerPublishedArticle: number | null;
};

type Period = { key: string; label: string };

type SortKey = "name" | "articlesPublished" | "authorsPublished" | "totalPageviews" | "evergreenPageviews" | "weightedAvgScrollDepth" | "weightedAvgTimeOnPage" | "pvPerPublishedArticle";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Site Name" },
  { key: "articlesPublished", label: "Articles Published" },
  { key: "authorsPublished", label: "Authors Published" },
  { key: "totalPageviews", label: "Total PVs" },
  { key: "evergreenPageviews", label: "Evergreen PVs" },
  { key: "weightedAvgScrollDepth", label: "Scroll Depth" },
];

const TABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Site" },
  { key: "articlesPublished", label: "Published" },
  { key: "authorsPublished", label: "Authors" },
  { key: "totalPageviews", label: "Total PVs" },
  { key: "evergreenPageviews", label: "Evergreen PVs" },
  { key: "weightedAvgScrollDepth", label: "Scroll Depth" },
  { key: "weightedAvgTimeOnPage", label: "Time on Page" },
  { key: "pvPerPublishedArticle", label: "PVs / New Article" },
];

export default function DepthChartsHomePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><p className="text-sm text-ink-soft">Loading…</p></main>}>
      <DepthChartsHomeInner />
    </Suspense>
  );
}

function DepthChartsHomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "NFL";

  const [allSites, setAllSites] = useState<Site[]>([]);
  const [summaries, setSummaries] = useState<Record<number, SiteSummary>>({});
  const [byDivision, setByDivision] = useState<Record<string, DivisionTotals>>({});
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalPageviews");
  const [sortDesc, setSortDesc] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const sites = useMemo(
    () => allSites.filter((s) => (s.division ?? "NFL") === division),
    [allSites, division]
  );
  const availableDivisions = DIVISIONS.filter((d) => d.status === "available");
  const divisionTotals = byDivision[division] ?? null;

  async function loadSummary(periodKey?: string) {
    const url = periodKey
      ? `/api/depth-chart-writers/all-sites-summary?period=${encodeURIComponent(periodKey)}`
      : "/api/depth-chart-writers/all-sites-summary";
    const res = await fetch(url).then((r) => r.json());
    setSummaries(res.sites ?? {});
    setByDivision(res.byDivision ?? {});
    setPeriods(res.availablePeriods ?? []);
    if (res.selectedPeriod) setSelectedPeriod(res.selectedPeriod.key);
  }

  useEffect(() => {
    Promise.all([fetch("/api/sites").then((r) => r.json()), loadSummary()])
      .then(([sitesRes]) => setAllSites(sitesRes.sites ?? []))
      .finally(() => setLoading(false));
  }, []);

  function handlePeriodChange(key: string) {
    setSelectedPeriod(key);
    loadSummary(key);
  }

  const sortedSites = useMemo(() => {
    const copy = [...sites];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        const cmp = a.site_name.localeCompare(b.site_name);
        return sortDesc ? -cmp : cmp;
      }
      const sa = summaries[a.id];
      const sb = summaries[b.id];
      const av = sa ? (sa[sortKey] ?? -Infinity) : -Infinity;
      const bv = sb ? (sb[sortKey] ?? -Infinity) : -Infinity;
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return copy;
  }, [sites, summaries, sortKey, sortDesc]);

  function handleHeaderClick(key: SortKey) {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(key !== "name");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            Division Overview
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">
            {division} Site Depth Charts and Performance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Click into any site to build out its writer roster.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {availableDivisions.length > 1 && (
            <label className="flex items-center gap-2 text-xs">
              <span className="text-ink-soft uppercase tracking-wide">Division</span>
              <select
                value={division}
                onChange={(e) => router.push(`?division=${e.target.value}`)}
                className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
              >
                {availableDivisions.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {periods.length > 0 && (
            <label className="flex items-center gap-2 text-xs">
              <span className="text-ink-soft uppercase tracking-wide">Month</span>
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
              >
                {periods.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-xs">
            <span className="text-ink-soft uppercase tracking-wide">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex overflow-hidden rounded border border-rule-strong">
            <button
              onClick={() => setViewMode("cards")}
              className="px-3 py-1 text-xs font-medium"
              style={
                viewMode === "cards"
                  ? { backgroundColor: "var(--ink-soft)", color: "white" }
                  : { color: "var(--ink-soft)" }
              }
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className="px-3 py-1 text-xs font-medium"
              style={
                viewMode === "table"
                  ? { backgroundColor: "var(--ink-soft)", color: "white" }
                  : { color: "var(--ink-soft)" }
              }
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading sites…</p>
      ) : (
        <>
          {divisionTotals && (
            <div className="card mb-6 rounded-md p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
                  Division Snapshot — {divisionTotals.periodLabel}
                </h2>
                <span className="font-data text-[11px] text-ink-soft">
                  {divisionTotals.siteCount} site{divisionTotals.siteCount === 1 ? "" : "s"} reporting
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
                <StatTile
                  label="Published"
                  value={divisionTotals.articlesPublished.toLocaleString()}
                />
                <StatTile
                  label="Total PVs"
                  value={formatCompactNumber(divisionTotals.totalPageviews)}
                />
                <StatTile
                  label="Evergreen PVs"
                  value={formatCompactNumber(divisionTotals.evergreenPageviews)}
                />
                <StatTile
                  label="Scroll Depth"
                  value={formatPercent(divisionTotals.weightedAvgScrollDepth)}
                />
                <StatTile
                  label="Time on Page"
                  value={formatDuration(divisionTotals.weightedAvgTimeOnPage)}
                />
                <StatTile
                  label="PVs / New Article"
                  value={
                    divisionTotals.pvPerPublishedArticle !== null
                      ? formatCompactNumber(divisionTotals.pvPerPublishedArticle)
                      : "—"
                  }
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            {viewMode === "table" ? (
              <div className="card overflow-x-auto rounded-md p-4" style={{ backgroundColor: "white" }}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                      {TABLE_COLUMNS.map((c) => (
                        <th
                          key={c.key}
                          className={`cursor-pointer select-none py-2 pr-4 hover:text-navy ${
                            c.key === "name" ? "" : "text-right"
                          }`}
                          onClick={() => handleHeaderClick(c.key)}
                        >
                          {c.label}
                          {sortKey === c.key && (sortDesc ? " ▼" : " ▲")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSites.map((site) => {
                      const s = summaries[site.id];
                      return (
                        <tr key={site.id} className="border-t border-rule">
                          <td className="py-2 pr-4">
                            <Link
                              href={dcSiteHref(site.id)}
                              className="font-medium text-navy hover:underline"
                            >
                              {site.site_name}
                            </Link>
                            <div className="text-xs text-ink-soft">{site.site_topic}</div>
                          </td>
                          <td className="py-2 pr-4 text-right font-data">
                            {s ? (
                              <HighlightValue
                                rank={rankAmong(site.id, (x: SiteSummary) => x.articlesPublished, summaries)}
                              >
                                {s.articlesPublished}
                              </HighlightValue>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right font-data">
                            {s ? s.authorsPublished : "—"}
                          </td>
                          <td className="py-2 pr-4 text-right font-data">
                            {s ? (
                              <HighlightValue
                                rank={rankAmong(site.id, (x: SiteSummary) => x.totalPageviews, summaries)}
                              >
                                {formatCompactNumber(s.totalPageviews)}
                              </HighlightValue>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right font-data">
                            {s ? (
                              <HighlightValue
                                rank={rankAmong(site.id, (x: SiteSummary) => x.evergreenPageviews, summaries)}
                              >
                                {formatCompactNumber(s.evergreenPageviews)}
                              </HighlightValue>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right font-data">
                            {s ? (
                              <HighlightValue
                                rank={rankAmong(site.id, (x: SiteSummary) => x.weightedAvgScrollDepth, summaries)}
                              >
                                {formatPercent(s.weightedAvgScrollDepth)}
                              </HighlightValue>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right font-data">
                            {s ? (
                              <HighlightValue
                                rank={rankAmong(site.id, (x: SiteSummary) => x.weightedAvgTimeOnPage, summaries)}
                              >
                                {formatDuration(s.weightedAvgTimeOnPage)}
                              </HighlightValue>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 text-right font-data">
                            {s && s.pvPerPublishedArticle !== null ? (
                              <HighlightValue
                                rank={rankAmong(site.id, (x: SiteSummary) => x.pvPerPublishedArticle, summaries)}
                              >
                                {formatCompactNumber(s.pvPerPublishedArticle)}
                              </HighlightValue>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sortedSites.map((site) => {
                const s = summaries[site.id];
                const colors = teamColor(site.site_topic);
                return (
                  <Link
                    key={site.id}
                    href={dcSiteHref(site.id)}
                    className="card group flex flex-col rounded-md border-l-4 p-3 transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{ borderLeftColor: colors.primary }}
                  >
                    <div className="font-display text-sm font-semibold text-navy">
                      {site.site_name}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                      {site.site_topic}
                    </div>
                    <div className="mt-1 font-data text-[11px] text-ink-soft">
                      {site.leader_name}
                    </div>

                    {s ? (
                      <div className="mt-2 grid grid-cols-2 gap-1 border-t border-rule pt-2">
                        <div className="font-data text-[10px] text-ink-soft">
                          <span className="font-semibold text-ink">
                            {s.articlesPublished}
                          </span>{" "}
                          published
                        </div>
                        <div className="font-data text-[10px] text-ink-soft">
                          <span className="font-semibold text-ink">
                            {s.authorsPublished}
                          </span>{" "}
                          authors
                        </div>
                        <div className="font-data text-[10px] text-ink-soft">
                          <span className="font-semibold text-ink">
                            {formatCompactNumber(s.totalPageviews)}
                          </span>{" "}
                          PVs
                        </div>
                        {sortKey === "evergreenPageviews" ? (
                          <div className="font-data text-[10px] text-ink-soft">
                            <span className="font-semibold text-ink">
                              {formatCompactNumber(s.evergreenPageviews)}
                            </span>{" "}
                            evergreen
                          </div>
                        ) : (
                          <div className="font-data text-[10px] text-ink-soft">
                            <span className="font-semibold text-ink">
                              {formatPercent(s.weightedAvgScrollDepth)}
                            </span>{" "}
                            scroll
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 border-t border-rule pt-2 text-[10px] italic text-ink-soft">
                        No traffic data yet
                      </div>
                    )}

                    <span className="mt-2 text-xs font-medium text-navy group-hover:underline">
                      View roster →
                    </span>
                  </Link>
                );
              })}
            </div>
            )}

            <div>
              <WriterLeaderboard division={division} period={selectedPeriod} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
