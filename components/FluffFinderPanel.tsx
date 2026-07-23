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

// Green-yellow-red, not a direct green-to-red blend — interpolating RGB
// straight from green to red passes through muddy olive/brown in the
// middle, which is hard to read as "medium." Going through a bright
// yellow midpoint keeps every stop visually distinct. Anchored to the
// 15th/85th percentiles of the population rather than raw min/max, so a
// single outlier writer doesn't stretch the whole scale and wash
// everyone else out into a narrow, hard-to-distinguish band.
const GOOD_COLOR: [number, number, number] = [22, 163, 74]; // vivid green
const MID_COLOR: [number, number, number] = [234, 179, 8]; // amber
const BAD_COLOR: [number, number, number] = [153, 27, 27]; // deep red
const GOOD_PERCENTILE = 0.15;
const BAD_PERCENTILE = 0.85;

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = p * (sortedAsc.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedAsc[lower];
  const frac = idx - lower;
  return sortedAsc[lower] + (sortedAsc[upper] - sortedAsc[lower]) * frac;
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function scoreColor(score: number, populationScoresAsc: number[]): string {
  if (populationScoresAsc.length < 2) return "rgb(100, 116, 139)"; // single-writer population — no meaningful comparison
  const good = percentile(populationScoresAsc, GOOD_PERCENTILE);
  const bad = percentile(populationScoresAsc, BAD_PERCENTILE);
  if (bad === good) return "rgb(100, 116, 139)"; // everyone tied — nothing to distinguish
  const t = Math.max(0, Math.min(1, (score - good) / (bad - good)));
  const rgb =
    t <= 0.5 ? lerpRgb(GOOD_COLOR, MID_COLOR, t * 2) : lerpRgb(MID_COLOR, BAD_COLOR, (t - 0.5) * 2);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

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
  divisionKey,
}: {
  writerOptions: FluffFinderWriterOption[];
  apiPrefix?: string;
  // When set, this instance is the division-wide entry point and the
  // population comparison spans every writer in the division. When
  // omitted, this is the team-wide entry point and the population is
  // just this one site's roster (inferred from writerOptions, which all
  // share the same siteId in that context).
  divisionKey?: string;
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
    setExcludeTopN(0);
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
  // articles. The Max Delta is the article where the gap between
  // traffic share and article share is largest — the point where this
  // writer's output has captured the most traffic relative to what a
  // proportional share would predict.
  const [populationScores, setPopulationScores] = useState<
    { writerId: number; concentrationScore: number; articlesPublished: number }[] | null
  >(null);

  useEffect(() => {
    if (!periodKey) return;
    const url = divisionKey
      ? `/api${apiPrefix}/depth-chart-writers/division-fluff-finder-scores?division=${encodeURIComponent(divisionKey)}&period=${encodeURIComponent(periodKey)}`
      : (() => {
          const siteId = sortedOptions[0]?.siteId;
          return siteId
            ? `/api${apiPrefix}/depth-chart-writers/site/${siteId}/fluff-finder-scores?period=${encodeURIComponent(periodKey)}`
            : null;
        })();
    if (!url) return;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setPopulationScores(d.scores ?? []))
      .catch(() => setPopulationScores(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, divisionKey, apiPrefix]);

  // Excluding the top N articles re-bases both axes to "of the remaining
  // articles" and "of the remaining traffic" — mathematically the same as
  // drawing the reference line from the top dot to the endpoint instead of
  // from the origin. Answers "excluding the outlier hit(s), how
  // efficiently does the rest of this writer's output perform?" as a
  // distinct question from "how top-heavy is everything," which the
  // un-excluded score still answers.
  const [excludeTopN, setExcludeTopN] = useState(0);

  const displayArticles = useMemo(() => {
    if (!result) return [];
    const n = Math.max(0, Math.min(excludeTopN, result.articles.length - 1));
    if (n === 0) return result.articles;
    const excluded = result.articles.slice(0, n);
    const excludedPv = excluded.reduce((s, a) => s + a.pageviews, 0);
    const remaining = result.articles.slice(n);
    const remainingTotalPv = result.totalPageviews - excludedPv;
    const remainingCount = remaining.length;
    return remaining.map((a, i) => ({
      ...a,
      rank: i + 1,
      cumulativePageviews: a.cumulativePageviews - excludedPv,
      cumulativePct: remainingTotalPv > 0 ? (a.cumulativePageviews - excludedPv) / remainingTotalPv : 0,
      cumulativeArticlePct: remainingCount > 0 ? (i + 1) / remainingCount : 0,
    }));
  }, [result, excludeTopN]);

  const stats = useMemo(() => {
    if (displayArticles.length === 0) return null;
    const points = [{ x: 0, y: 0 }, ...displayArticles.map((a) => ({ x: a.cumulativeArticlePct, y: a.cumulativePct }))];
    let area = 0;
    for (let i = 1; i < points.length; i++) {
      const { x: x1, y: y1 } = points[i - 1];
      const { x: x2, y: y2 } = points[i];
      area += ((x2 - x1) * (y1 + y2)) / 2;
    }
    const concentrationScore = Math.max(0, Math.min(1, 2 * area - 1));

    let peak = displayArticles[0];
    let peakGap = -Infinity;
    for (const a of displayArticles) {
      const gap = a.cumulativePct - a.cumulativeArticlePct;
      if (gap > peakGap) {
        peakGap = gap;
        peak = a;
      }
    }
    return { concentrationScore, peak, peakGap };
  }, [displayArticles]);

  const boxColor = useMemo(() => {
    if (!stats || !populationScores || populationScores.length < 2) return null;
    const scores = populationScores.map((s) => s.concentrationScore).sort((a, b) => a - b);
    return scoreColor(stats.concentrationScore, scores);
  }, [stats, populationScores]);

  // Sidebar list: population scores matched back to their writer's display
  // info (name, site, click-target key), colored the same way as the main
  // score box, sorted by concentration score (least efficient first) so
  // the writers most worth reviewing surface at the top by default.
  const sidebarEntries = useMemo(() => {
    if (!populationScores) return [];
    const optionByWriterId = new Map(sortedOptions.map((o) => [o.writerId, o]));
    const scoresAsc = populationScores.map((s) => s.concentrationScore).sort((a, b) => a - b);
    return populationScores
      .map((s) => {
        const option = optionByWriterId.get(s.writerId);
        if (!option) return null;
        return {
          key: `${option.siteId}::${option.writerId}`,
          label: option.label,
          articlesPublished: s.articlesPublished,
          concentrationScore: s.concentrationScore,
          color: scoreColor(s.concentrationScore, scoresAsc),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.concentrationScore - a.concentrationScore);
  }, [populationScores, sortedOptions]);

  const [minArticles, setMinArticles] = useState(0);
  // Colors stay anchored to the full population regardless of the filter —
  // otherwise the green-to-red scale would keep shifting as writers are
  // filtered in and out, making colors incomparable between views.
  const filteredSidebarEntries = useMemo(
    () => sidebarEntries.filter((e) => e.articlesPublished >= minArticles),
    [sidebarEntries, minArticles]
  );

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
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="card min-w-0 flex-1 rounded-md p-4">
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
          {result && result.articles.length > 1 && (
            <label className="flex items-center gap-1.5 rounded border border-rule-strong bg-white px-2 py-1.5 text-xs">
              <span className="text-ink-soft uppercase tracking-wide">Exclude top</span>
              <input
                type="number"
                min={0}
                max={result.articles.length - 1}
                value={excludeTopN}
                onChange={(e) =>
                  setExcludeTopN(Math.max(0, Math.min(result.articles.length - 1, Number(e.target.value) || 0)))
                }
                className="w-10 rounded border border-rule-strong bg-white px-1 py-0.5 text-center font-data outline-none focus:border-navy"
              />
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-ink-soft">Loading…</p>
      ) : !result || displayArticles.length === 0 ? (
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

          {excludeTopN > 0 && result.totalPageviews > 0 && (
            <p className="mb-2 rounded border border-rule-strong bg-paper px-2 py-1.5 text-[11px] text-ink-soft">
              Excluding top {excludeTopN} article{excludeTopN === 1 ? "" : "s"} (
              {formatCompactNumber(result.articles.slice(0, excludeTopN).reduce((s, a) => s + a.pageviews, 0))} PVs,{" "}
              {formatPercent(
                result.articles.slice(0, excludeTopN).reduce((s, a) => s + a.pageviews, 0) / result.totalPageviews
              )}{" "}
              of total traffic) — everything below reflects the remaining {displayArticles.length} article
              {displayArticles.length === 1 ? "" : "s"} only.
            </p>
          )}

          {stats && (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div
                className="rounded border p-3"
                style={
                  boxColor
                    ? { borderColor: boxColor, borderWidth: 2, backgroundColor: `${boxColor}1a` }
                    : { borderColor: "var(--rule-strong)", backgroundColor: "white" }
                }
              >
                <p className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Concentration Score
                </p>
                <p
                  className="font-display text-xl font-bold"
                  style={{ color: boxColor ?? "var(--navy)" }}
                >
                  {formatPercent(stats.concentrationScore)}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {boxColor
                    ? "Color reflects this writer's rank among their peers this period — green is most efficient, red is least."
                    : "0% = every article contributes its proportional share of traffic. Higher means traffic is more concentrated in fewer articles."}
                </p>
              </div>
              <div className="rounded border border-rule-strong bg-white p-3">
                <p className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Max Delta
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
            <LineChart data={displayArticles} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
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
                {displayArticles.map((a) => (
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
                    <td className="max-w-[180px] truncate py-1.5 pr-4" title={a.title}>
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

      <div className="card w-full shrink-0 rounded-md p-4 lg:w-72">
        <h3 className="mb-0.5 font-display text-sm font-semibold uppercase tracking-wide text-navy">
          All Writers
        </h3>
        <p className="mb-2 text-[11px] text-ink-soft">
          Article volume and Concentration Score for this period. Click anyone to see their
          graph.
        </p>
        <label className="mb-2 flex items-center gap-2 text-[11px]">
          <span className="text-ink-soft uppercase tracking-wide">Min. articles</span>
          <input
            type="number"
            min={0}
            value={minArticles}
            onChange={(e) => setMinArticles(Math.max(0, Number(e.target.value) || 0))}
            className="w-16 rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs outline-none focus:border-navy"
          />
        </label>
        {sidebarEntries.length === 0 ? (
          <p className="text-sm italic text-ink-soft">No data for this period yet.</p>
        ) : filteredSidebarEntries.length === 0 ? (
          <p className="text-sm italic text-ink-soft">No writers meet that minimum.</p>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 font-data text-[10px] uppercase tracking-wide text-ink-soft">
              <span>Writer</span>
              <span className="flex shrink-0 gap-3">
                <span>Arts.</span>
                <span>Score</span>
              </span>
            </div>
            <div className="max-h-[600px] space-y-1 overflow-y-auto pr-1">
              {filteredSidebarEntries.map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => setSelectedKey(entry.key)}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-paper"
                  style={
                    entry.key === selectedKey
                      ? { backgroundColor: "var(--navy)", color: "white" }
                      : undefined
                  }
                >
                  <span className="truncate">{entry.label}</span>
                  <span className="flex shrink-0 items-center gap-3 font-data">
                    <span
                      className={`w-6 text-right ${entry.key === selectedKey ? "" : "text-ink-soft"}`}
                    >
                      {entry.articlesPublished}
                    </span>
                    <span
                      className="w-10 text-right font-semibold"
                      style={{ color: entry.key === selectedKey ? "white" : entry.color }}
                    >
                      {formatPercent(entry.concentrationScore)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
