"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { HISTORY_METRICS, HistoryMetricKey } from "@/lib/historyMetrics";
import { filterByRange, distinctYears, pivotByYear, ChronoPoint } from "@/lib/historyChartUtils";

const YEAR_COLORS = ["var(--navy)", "var(--grade-good)", "var(--grease-red)", "var(--grade-mid)"];

type HistoryPoint = ChronoPoint & {
  ranks: Record<string, { rank: number; total: number } | null>;
};

function RankDot(props: any) {
  const { cx, cy, payload, metricKey, rankField } = props;
  if (cx === undefined || cy === undefined) return null;
  const ranksObj = rankField ? payload[rankField] : payload.ranks;
  const rankInfo = ranksObj?.[metricKey];
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="var(--navy)" />
      {rankInfo && (
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize={10} fill="var(--ink-soft)">
          #{rankInfo.rank}
        </text>
      )}
    </g>
  );
}

export function SiteHistoryChart({ siteId }: { siteId: number }) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<HistoryMetricKey>("totalPageviews");
  const [startKey, setStartKey] = useState<string>("");
  const [endKey, setEndKey] = useState<string>("");
  const [mode, setMode] = useState<"timeline" | "years">("timeline");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/depth-chart-writers/site/${siteId}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [siteId]);

  const metricDef = HISTORY_METRICS.find((m) => m.key === metric)!;
  const years = useMemo(() => distinctYears(history), [history]);
  const filtered = useMemo(
    () => filterByRange(history, startKey || null, endKey || null),
    [history, startKey, endKey]
  );

  const yearRows = useMemo(
    () => pivotByYear(filtered, [metric, "ranks"]),
    [filtered, metric]
  );

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
          Site Snapshot Trend
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {years.length >= 2 && (
            <div className="flex overflow-hidden rounded border border-rule-strong">
              <button
                onClick={() => setMode("timeline")}
                className="px-2 py-1 text-[11px] font-medium"
                style={
                  mode === "timeline"
                    ? { backgroundColor: "var(--ink-soft)", color: "white" }
                    : { color: "var(--ink-soft)" }
                }
              >
                Timeline
              </button>
              <button
                onClick={() => setMode("years")}
                className="px-2 py-1 text-[11px] font-medium"
                style={
                  mode === "years"
                    ? { backgroundColor: "var(--ink-soft)", color: "white" }
                    : { color: "var(--ink-soft)" }
                }
              >
                Compare Years
              </button>
            </div>
          )}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as HistoryMetricKey)}
            className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
          >
            {HISTORY_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {history.length > 2 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-soft uppercase tracking-wide">From</span>
          <select
            value={startKey}
            onChange={(e) => setStartKey(e.target.value)}
            className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
          >
            <option value="">Earliest</option>
            {history.map((h) => (
              <option key={h.periodKey} value={h.periodKey}>
                {h.periodLabel}
              </option>
            ))}
          </select>
          <span className="text-ink-soft uppercase tracking-wide">To</span>
          <select
            value={endKey}
            onChange={(e) => setEndKey(e.target.value)}
            className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
          >
            <option value="">Latest</option>
            {history.map((h) => (
              <option key={h.periodKey} value={h.periodKey}>
                {h.periodLabel}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-ink-soft">Loading…</p>
      ) : filtered.length < 2 ? (
        <p className="text-xs italic text-ink-soft">
          Need at least two months of data in this range to chart a trend.
        </p>
      ) : mode === "timeline" ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                tickFormatter={(v) => metricDef.format(v)}
              />
              <Tooltip
                formatter={(v: any) => [metricDef.format(Number(v)), metricDef.label]}
                labelStyle={{ fontFamily: "var(--font-data)" }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="var(--navy)"
                strokeWidth={2}
                dot={<RankDot metricKey={metric} />}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearRows} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                tickFormatter={(v) => metricDef.format(v)}
              />
              <Tooltip
                formatter={(v: any, seriesKey: any) => [
                  metricDef.format(Number(v)),
                  `${String(seriesKey).split("::")[0]} ${metricDef.label}`,
                ]}
              />
              <Legend />
              {years.map((year, i) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`${year}::${metric}`}
                  name={year}
                  stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                  strokeWidth={2}
                  dot={<RankDot metricKey={metric} rankField={`${year}::ranks`} />}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
