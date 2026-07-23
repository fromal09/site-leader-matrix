"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { formatCompactNumber, formatPercent, ensureUrlProtocol } from "@/lib/trafficFormat";

export type FluffFinderWriterOption = {
  writerId: number;
  siteId: number;
  label: string; // display name — "Writer Name" (team-wide) or "Writer Name (Site)" (division-wide)
  articlesPublished: number;
};

type FluffArticle = {
  rank: number;
  title: string;
  url: string | null;
  pageviews: number;
  cumulativePageviews: number;
  cumulativePct: number;
  cumulativeArticlePct: number;
};

type FluffResult = {
  writerId: number;
  writerName: string;
  periodKey: string | null;
  periodLabel: string | null;
  availablePeriods: { key: string; label: string }[];
  totalPageviews: number;
  articles: FluffArticle[];
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as FluffArticle;
  const gap = point.cumulativePct - point.cumulativeArticlePct;
  return (
    <div className="rounded border border-rule-strong bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-display font-semibold text-navy">Article #{point.rank}</div>
      <div className="mt-1 max-w-xs font-data text-[11px] text-ink">{point.title}</div>
      <div className="mt-1 font-data">
        {formatPercent(point.cumulativeArticlePct)} of articles →{" "}
        <strong>{formatPercent(point.cumulativePct)}</strong> of traffic
      </div>
      <div className="font-data" style={{ color: gap > 0 ? "var(--grade-good)" : "var(--grade-low)" }}>
        {gap >= 0 ? "+" : ""}
        {formatPercent(gap)} vs. proportional share
      </div>
      <div className="mt-1 font-data text-ink-soft">
        This article: {formatCompactNumber(point.pageviews)} PVs
      </div>
    </div>
  );
}

export function FluffFinderPanel({
  writerOptions,
  apiPrefix = "",
}: {
  writerOptions: FluffFinderWriterOption[];
  apiPrefix?: string;
}) {
  const sortedOptions = useMemo(
    () => [...writerOptions].sort((a, b) => b.articlesPublished - a.articlesPublished),
    [writerOptions]
  );
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [periodKey, setPeriodKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FluffResult | null>(null);

  useEffect(() => {
    if (sortedOptions.length > 0 && !selectedKey) {
      setSelectedKey(`${sortedOptions[0].siteId}::${sortedOptions[0].writerId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedOptions]);

  // A different writer usually means a different site, which can have a
  // different set of available periods — don't carry over a selection
  // that might not exist there.
  useEffect(() => {
    setPeriodKey("");
  }, [selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;
    const [siteId, writerId] = selectedKey.split("::");
    setLoading(true);
    const periodQuery = periodKey ? `&period=${encodeURIComponent(periodKey)}` : "";
    fetch(`/api${apiPrefix}/depth-chart-writers/site/${siteId}/fluff-finder?writerId=${writerId}${periodQuery}`)
      .then((r) => r.json())
      .then((d) => {
        setResult(d);
        // Sync the dropdown to whatever period the backend actually used
        // (e.g. the default "most recent" pick on first load).
        if (d.periodKey) setPeriodKey(d.periodKey);
      })
      .finally(() => setLoading(false));
  }, [selectedKey, periodKey, apiPrefix]);

  // Concentration score: area between the actual traffic curve and the
  // "perfect efficiency" diagonal (where article share always equals
  // traffic share), normalized the same way a Gini coefficient is —
  // computed via the trapezoidal rule over (cumulative article %,
  // cumulative traffic %) points starting from the origin. 0 means every
  // article contributes proportionally to its share of output; toward 1
  // means traffic is extremely concentrated in a small fraction of
  // articles. The suggested cutoff is the article where the gap between
  // traffic share and article share is largest — the point where this
  // writer's output has captured the most traffic relative to what a
  // proportional share would predict.
  const stats = useMemo(() => {
    if (!result || result.articles.length === 0) return null;
    const points = [{ x: 0, y: 0 }, ...result.articles.map((a) => ({ x: a.cumulativeArticlePct, y: a.cumulativePct }))];
    let area = 0;
    for (let i = 1; i < points.length; i++) {
      const { x: x1, y: y1 } = points[i - 1];
      const { x: x2, y: y2 } = points[i];
      area += ((x2 - x1) * (y1 + y2)) / 2;
    }
    const concentrationScore = Math.max(0, Math.min(1, 2 * area - 1));

    let peak = result.articles[0];
    let peakGap = -Infinity;
    for (const a of result.articles) {
      const gap = a.cumulativePct - a.cumulativeArticlePct;
      if (gap > peakGap) {
        peakGap = gap;
        peak = a;
      }
    }
    return { concentrationScore, peak, peakGap };
  }, [result]);

  if (sortedOptions.length === 0) {
    return (
      <div className="card rounded-md p-4">
        <p className="text-sm italic text-ink-soft">
          No writers with published articles this period yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card rounded-md p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Fluff Finder</h2>
          <p className="text-xs text-ink-soft">
            Ranks a writer&apos;s articles for the selected month by pageviews and shows the
            running share of their total traffic — helps spot where new content stops
            meaningfully adding to the total.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
          >
            {sortedOptions.map((o) => (
              <option key={`${o.siteId}::${o.writerId}`} value={`${o.siteId}::${o.writerId}`}>
                {o.label} ({o.articlesPublished})
              </option>
            ))}
          </select>
          {result && result.availablePeriods.length > 1 && (
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
            >
              {result.availablePeriods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-ink-soft">Loading…</p>
      ) : !result || result.articles.length === 0 ? (
        <p className="py-8 text-center text-sm italic text-ink-soft">
          No published articles this period for this writer.
        </p>
      ) : (
        <>
          {result.periodLabel && (
            <p className="mb-2 font-data text-[11px] uppercase tracking-wide text-ink-soft">
              {result.periodLabel}
            </p>
          )}

          {stats && (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded border border-rule-strong bg-white p-3">
                <p className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Concentration Score
                </p>
                <p className="font-display text-xl font-bold text-navy">
                  {formatPercent(stats.concentrationScore)}
                </p>
                <p className="text-[11px] text-ink-soft">
                  0% = every article contributes its proportional share of traffic. Higher
                  means traffic is more concentrated in fewer articles.
                </p>
              </div>
              <div className="rounded border border-rule-strong bg-white p-3">
                <p className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Suggested Cutoff
                </p>
                <p className="font-display text-xl font-bold text-navy">
                  Article #{stats.peak.rank}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {formatPercent(stats.peak.cumulativeArticlePct)} of articles have produced{" "}
                  {formatPercent(stats.peak.cumulativePct)} of traffic here — the largest gap
                  between article share and traffic share.
                </p>
              </div>
            </div>
          )}

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={result.articles} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis
                dataKey="rank"
                type="number"
                name="Article Number"
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                stroke="var(--rule-strong)"
                label={{ value: "Article Number", position: "insideBottom", offset: -5, fontSize: 11 }}
              />
              <YAxis
                dataKey="cumulativePct"
                domain={[0, 1]}
                tickFormatter={(v) => formatPercent(v)}
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                stroke="var(--rule-strong)"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="linear"
                dataKey="cumulativeArticlePct"
                stroke="var(--ink-soft)"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
                tooltipType="none"
                name="Proportional share"
              />
              <Line
                type="monotone"
                dataKey="cumulativePct"
                stroke="var(--navy)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--navy)" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
              {stats && (
                <ReferenceDot
                  x={stats.peak.rank}
                  y={stats.peak.cumulativePct}
                  r={6}
                  fill="var(--grease-red)"
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Article</th>
                  <th className="py-2 pr-4 text-right">PVs</th>
                  <th className="py-2 pr-4 text-right">Cumulative % of Articles</th>
                  <th className="py-2 text-right">Cumulative % of PVs</th>
                </tr>
              </thead>
              <tbody>
                {result.articles.map((a) => (
                  <tr
                    key={a.rank}
                    className="border-t border-rule"
                    style={
                      stats && a.rank === stats.peak.rank
                        ? { backgroundColor: "rgba(200, 60, 50, 0.08)" }
                        : undefined
                    }
                  >
                    <td className="py-1.5 pr-4 font-data">{a.rank}</td>
                    <td className="max-w-md truncate py-1.5 pr-4">
                      {a.url ? (
                        <a
                          href={ensureUrlProtocol(a.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-navy hover:underline"
                        >
                          {a.title}
                        </a>
                      ) : (
                        a.title
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-data">
                      {formatCompactNumber(a.pageviews)}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-data">
                      {formatPercent(a.cumulativeArticlePct)}
                    </td>
                    <td className="py-1.5 text-right font-data">{formatPercent(a.cumulativePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
