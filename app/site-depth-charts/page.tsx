"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { dcSiteHref } from "@/lib/routes";
import { formatCompactNumber, formatPercent } from "@/lib/trafficFormat";
import { teamColor } from "@/lib/nflTeamColors";
import { WriterLeaderboard } from "@/components/WriterLeaderboard";
import type { Site } from "@/lib/types";

type SiteSummary = {
  periodLabel: string;
  articlesPublished: number;
  authorsPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

type SortKey = "name" | "articlesPublished" | "authorsPublished" | "totalPageviews" | "evergreenPageviews" | "weightedAvgScrollDepth";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Site Name" },
  { key: "articlesPublished", label: "Articles Published" },
  { key: "authorsPublished", label: "Authors Published" },
  { key: "totalPageviews", label: "Total PVs" },
  { key: "evergreenPageviews", label: "Evergreen PVs" },
  { key: "weightedAvgScrollDepth", label: "Scroll Depth" },
];

export default function DepthChartsHomePage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [summaries, setSummaries] = useState<Record<number, SiteSummary>>({});
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");

  useEffect(() => {
    Promise.all([
      fetch("/api/sites").then((r) => r.json()),
      fetch("/api/depth-chart-writers/all-sites-summary").then((r) => r.json()),
    ])
      .then(([sitesRes, summaryRes]) => {
        setSites(sitesRes.sites ?? []);
        setSummaries(summaryRes.sites ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedSites = useMemo(() => {
    const copy = [...sites];
    copy.sort((a, b) => {
      if (sortKey === "name") return a.site_name.localeCompare(b.site_name);
      const sa = summaries[a.id];
      const sb = summaries[b.id];
      const av = sa ? (sa[sortKey] ?? -Infinity) : -Infinity;
      const bv = sb ? (sb[sortKey] ?? -Infinity) : -Infinity;
      return (bv as number) - (av as number);
    });
    return copy;
  }, [sites, summaries, sortKey]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            Division Overview
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">
            Site Depth Charts
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Click into any site to build out its writer roster.
          </p>
        </div>
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
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading sites…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
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
                      <div className="font-data text-[10px] text-ink-soft">
                        <span className="font-semibold text-ink">
                          {formatPercent(s.weightedAvgScrollDepth)}
                        </span>{" "}
                        scroll
                      </div>
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

          <div>
            <WriterLeaderboard />
          </div>
        </div>
      )}
    </main>
  );
}
