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
import { formatCompactNumber } from "@/lib/trafficFormat";
import { filterByRange, distinctYears, pivotByYear, ChronoPoint } from "@/lib/historyChartUtils";

const YEAR_COLORS = ["var(--grade-mid)", "var(--navy)", "var(--grade-good)", "var(--grease-red)"];

type HistoryPoint = ChronoPoint & { homepagePageviews: number };

export function HomepageHistoryChart({ siteId }: { siteId: number }) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [startKey, setStartKey] = useState("");
  const [endKey, setEndKey] = useState("");
  const [mode, setMode] = useState<"timeline" | "years">("timeline");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/depth-chart-writers/site/${siteId}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [siteId]);

  const years = useMemo(() => distinctYears(history), [history]);
  const filtered = useMemo(
    () => filterByRange(history, startKey || null, endKey || null),
    [history, startKey, endKey]
  );
  const yearRows = useMemo(() => pivotByYear(filtered, ["homepagePageviews"]), [filtered]);

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
          Homepage &amp; Site Pages Trend
        </h2>
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
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                tickFormatter={(v) => formatCompactNumber(v)}
              />
              <Tooltip
                formatter={(v: any) => [formatCompactNumber(Number(v)), "Homepage & Site Pages PVs"]}
              />
              <Line
                type="monotone"
                dataKey="homepagePageviews"
                stroke="var(--grade-mid)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--grade-mid)" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearRows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                tickFormatter={(v) => formatCompactNumber(v)}
              />
              <Tooltip
                formatter={(v: any, seriesKey: any) => [
                  formatCompactNumber(Number(v)),
                  `${String(seriesKey).split("::")[0]} Homepage PVs`,
                ]}
              />
              <Legend />
              {years.map((year, i) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`${year}::homepagePageviews`}
                  name={year}
                  stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
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
