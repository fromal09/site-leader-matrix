"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { writerTrafficHref } from "@/lib/routes";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import type { LeaderboardWriter } from "@/lib/traffic";

type MetricKey = "totalPageviews" | "pvPerPublishedArticle" | "weightedAvgScrollDepth" | "weightedAvgTimeOnPage" | "articlesPublished";

const METRICS: { key: MetricKey; label: string; format: (w: LeaderboardWriter) => string }[] = [
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

export function WriterLeaderboard({ division, period }: { division: string; period?: string | null }) {
  const [writers, setWriters] = useState<LeaderboardWriter[]>([]);
  const [cardsChecked, setCardsChecked] = useState(0);
  const [cardsMatched, setCardsMatched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<MetricKey>("totalPageviews");
  const [minArticles, setMinArticles] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ division });
    if (period) params.set("period", period);
    fetch(`/api/depth-chart-writers/leaderboard?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setWriters(d.writers ?? []);
        setCardsChecked(d.cardsChecked ?? 0);
        setCardsMatched(d.cardsMatched ?? 0);
      })
      .finally(() => setLoading(false));
  }, [division, period]);

  const metricDef = METRICS.find((m) => m.key === metric)!;

  const top10 = useMemo(() => {
    const filtered = writers.filter((w) => w.articlesPublished >= minArticles);
    const sorted = [...filtered].sort((a, b) => {
      const av = a[metric];
      const bv = b[metric];
      return (bv ?? -Infinity) - (av ?? -Infinity);
    });
    return sorted.slice(0, 10);
  }, [writers, metric, minArticles]);

  return (
    <div className="card rounded-md p-4">
      <h2 className="font-display text-lg font-semibold text-navy">Top 10 Writers</h2>
      <p className="font-data text-[11px] text-ink-soft">Division-wide, most recent period</p>

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
              <li key={w.writerId} className="flex items-center gap-2 text-xs">
                <span className="w-4 font-data text-ink-soft">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={writerTrafficHref(w.writerId)}
                    className="block truncate font-medium text-navy hover:underline"
                  >
                    {w.name}
                  </Link>
                  <div className="truncate font-data text-[10px] text-ink-soft">
                    {w.siteName}
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
