"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { writerTrafficHref } from "@/lib/routes";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import { pageviewWeightedAverage } from "@/lib/trafficStats";
import { normalizeNameKey, pickBestCasing } from "@/lib/nameNormalize";
import type { LeaderboardWriter } from "@/lib/traffic";

type MetricKey = "totalPageviews" | "pvPerPublishedArticle" | "weightedAvgScrollDepth" | "weightedAvgTimeOnPage" | "articlesPublished";

type DisplayWriter = {
  writerId: number;
  name: string;
  role: string;
  siteId: number | null;
  siteName: string | null;
  siteCount?: number;
  periodLabel: string;
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

const METRICS: { key: MetricKey; label: string; format: (w: DisplayWriter) => string }[] = [
  { key: "totalPageviews", label: "Total Pageviews", format: (w) => formatCompactNumber(w.totalPageviews) },
  {
    key: "pvPerPublishedArticle",
    label: "PVs / New Article",
    format: (w) => (w.pvPerPublishedArticle !== null ? formatCompactNumber(w.pvPerPublishedArticle) : "—"),
  },
  {
    key: "weightedAvgScrollDepth",
    label: "Scroll Depth",
    format: (w) => formatPercent(w.weightedAvgScrollDepth),
  },
  {
    key: "weightedAvgTimeOnPage",
    label: "Time on Page",
    format: (w) => formatDuration(w.weightedAvgTimeOnPage),
  },
  { key: "articlesPublished", label: "Articles Published", format: (w) => String(w.articlesPublished) },
];

export function WriterLeaderboard({ division, period, apiPrefix = "" }: { division: string; period?: string | null; apiPrefix?: string }) {
  const [writers, setWriters] = useState<LeaderboardWriter[]>([]);
  const [cardsChecked, setCardsChecked] = useState(0);
  const [cardsMatched, setCardsMatched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<MetricKey>("totalPageviews");
  const [minArticles, setMinArticles] = useState(0);
  const [viewMode, setViewMode] = useState<"aggregate" | "site">("aggregate");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ division });
    if (period) params.set("period", period);
    fetch(`/api${apiPrefix}/depth-chart-writers/leaderboard?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setWriters(d.writers ?? []);
        setCardsChecked(d.cardsChecked ?? 0);
        setCardsMatched(d.cardsMatched ?? 0);
      })
      .finally(() => setLoading(false));
  }, [division, period]);

  const metricDef = METRICS.find((m) => m.key === metric)!;

  // Combines a writer's rows across every site in the division into one
  // entry — e.g. a Rover active on 3 sites shows as a single combined line
  // instead of 3 separate ones.
  const aggregatedWriters = useMemo(() => {
    const byName = new Map<
      string,
      { variants: Set<string>; writerId: number; rows: LeaderboardWriter[] }
    >();
    for (const w of writers) {
      const key = normalizeNameKey(w.name);
      if (!byName.has(key)) byName.set(key, { variants: new Set(), writerId: w.writerId, rows: [] });
      const group = byName.get(key)!;
      group.variants.add(w.name);
      group.rows.push(w);
    }
    return Array.from(byName.values()).map(({ variants, writerId, rows }) => {
      const articlesPublished = rows.reduce((s, r) => s + r.articlesPublished, 0);
      const totalPageviews = rows.reduce((s, r) => s + r.totalPageviews, 0);
      const publishedPageviews = rows.reduce(
        (s, r) => s + (r.pvPerPublishedArticle ?? 0) * r.articlesPublished,
        0
      );
      return {
        writerId,
        name: pickBestCasing(Array.from(variants)),
        role: rows[0].role,
        siteId: null as number | null,
        siteName: null as string | null,
        siteCount: rows.length,
        periodLabel: rows[0].periodLabel,
        articlesPublished,
        totalPageviews,
        pvPerPublishedArticle: articlesPublished > 0 ? publishedPageviews / articlesPublished : null,
        weightedAvgScrollDepth: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.weightedAvgScrollDepth, pageviews: r.totalPageviews }))
        ),
        weightedAvgTimeOnPage: pageviewWeightedAverage(
          rows.map((r) => ({ value: r.weightedAvgTimeOnPage, pageviews: r.totalPageviews }))
        ),
      };
    });
  }, [writers]);

  const displayWriters: DisplayWriter[] = viewMode === "aggregate" ? aggregatedWriters : writers;

  const top10 = useMemo(() => {
    const filtered = displayWriters.filter((w) => w.articlesPublished >= minArticles);
    const sorted = [...filtered].sort((a, b) => {
      const av = a[metric];
      const bv = b[metric];
      return (bv ?? -Infinity) - (av ?? -Infinity);
    });
    return sorted.slice(0, 10);
  }, [displayWriters, metric, minArticles]);

  return (
    <div className="card rounded-md p-4">
      <h2 className="font-display text-lg font-semibold text-navy">Top 10 Writers</h2>
      <p className="font-data text-[11px] text-ink-soft">Division-wide, most recent period</p>

      <div className="mt-2 flex overflow-hidden rounded border border-navy">
        <button
          onClick={() => setViewMode("aggregate")}
          className="flex-1 px-2 py-1 text-[11px] font-medium"
          style={
            viewMode === "aggregate"
              ? { backgroundColor: "var(--navy)", color: "white" }
              : { color: "var(--navy)" }
          }
        >
          Aggregate
        </button>
        <button
          onClick={() => setViewMode("site")}
          className="flex-1 px-2 py-1 text-[11px] font-medium"
          style={
            viewMode === "site"
              ? { backgroundColor: "var(--navy)", color: "white" }
              : { color: "var(--navy)" }
          }
        >
          Site-Specific
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricKey)}
          className="w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              Rank by: {m.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          Min. new articles this period
          <input
            type="number"
            min={0}
            value={minArticles}
            onChange={(e) => setMinArticles(Math.max(0, Number(e.target.value)))}
            className="w-16 rounded border border-rule-strong bg-white px-2 py-1 text-sm outline-none focus:border-navy"
          />
        </label>
      </div>

      <div className="mt-3">
        {loading ? (
          <p className="text-xs text-ink-soft">Loading…</p>
        ) : top10.length === 0 ? (
          <p className="text-xs italic text-ink-soft">
            {cardsChecked === 0
              ? `No writer cards exist for this division yet.`
              : `Checked ${cardsChecked} writer card${cardsChecked === 1 ? "" : "s"} — ${cardsMatched} matched traffic data for this period. ${
                  cardsMatched === 0
                    ? "Check that each card's traffic dashboard name (or an alias) matches the byline in your upload."
                    : "None meet the current filter."
                }`}
          </p>
        ) : (
          <ol className="space-y-1.5">
            {top10.map((w, i) => (
              <li key={`${w.writerId}-${w.siteId ?? "agg"}`} className="flex items-center gap-2 text-xs">
                <span className="w-4 font-data text-ink-soft">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={writerTrafficHref(w.writerId)}
                    className="block truncate font-medium uppercase text-navy hover:underline"
                  >
                    {w.name}
                  </Link>
                  <div className="truncate font-data text-[10px] text-ink-soft">
                    {viewMode === "aggregate"
                      ? `${w.siteCount} site${w.siteCount === 1 ? "" : "s"}`
                      : w.siteName}
                  </div>
                </div>
                <span className="shrink-0 font-data text-[11px] font-semibold text-ink">
                  {metricDef.format(w)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
