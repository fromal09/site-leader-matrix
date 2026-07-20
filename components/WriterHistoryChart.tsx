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
import { HISTORY_METRICS, HistoryMetricKey, computeImpliedContentDepth } from "@/lib/historyMetrics";
import { filterByRange, distinctYears, ChronoPoint } from "@/lib/historyChartUtils";
import type { DepthChartWriter } from "@/lib/depthCharts";

const WRITER_COLORS = ["var(--navy)", "var(--grade-good)", "var(--grease-red)"];
const YEAR_DASHES = ["0", "6 4", "2 3"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type WriterHistory = {
  writerId: number;
  name: string;
  history: ChronoPoint[];
};

export function WriterHistoryChart({ writers }: { writers: DepthChartWriter[] }) {
  const [selected, setSelected] = useState<(number | "")[]>([writers[0]?.id ?? "", "", ""]);
  const [metric, setMetric] = useState<HistoryMetricKey>("totalPageviews");
  const [data, setData] = useState<WriterHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [startKey, setStartKey] = useState("");
  const [endKey, setEndKey] = useState("");
  const [mode, setMode] = useState<"timeline" | "years">("timeline");

  const ids = selected.filter((id): id is number => id !== "");
  const idsKey = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setData([]);
      return;
    }
    setLoading(true);
    fetch(`/api/depth-chart-writers/history-compare?writerIds=${idsKey}`)
      .then((r) => r.json())
      .then((d) =>
        setData(
          (d.writers ?? []).map((w: WriterHistory) => ({
            ...w,
            history: w.history.map((p) => ({
              ...p,
              impliedContentDepth: computeImpliedContentDepth(
                p.weightedAvgScrollDepth,
                p.weightedAvgTimeOnPage
              ),
            })),
          }))
        )
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const metricDef = HISTORY_METRICS.find((m) => m.key === metric)!;

  const allPoints = useMemo(() => data.flatMap((w) => w.history), [data]);
  const filteredData = useMemo(
    () =>
      data.map((w) => ({
        ...w,
        history: filterByRange(w.history, startKey || null, endKey || null),
      })),
    [data, startKey, endKey]
  );
  const years = useMemo(
    () => distinctYears(filteredData.flatMap((w) => w.history)),
    [filteredData]
  );

  const timelineData = useMemo(() => {
    const periodMap = new Map<string, any>();
    for (const w of filteredData) {
      for (const h of w.history) {
        if (!periodMap.has(h.periodKey)) {
          periodMap.set(h.periodKey, { periodKey: h.periodKey, periodLabel: h.periodLabel });
        }
        periodMap.get(h.periodKey)[`w${w.writerId}`] = h[metric];
      }
    }
    return Array.from(periodMap.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [filteredData, metric]);

  const yearRows = useMemo(() => {
    const rows: Record<string, any>[] = MONTH_NAMES.map((m, i) => ({ month: m, monthNum: i + 1 }));
    for (const w of filteredData) {
      for (const h of w.history) {
        const year = h.periodKey.slice(0, 4);
        const monthNum = Number(h.periodKey.slice(5, 7));
        const row = rows.find((r) => r.monthNum === monthNum);
        if (!row) continue;
        row[`w${w.writerId}::${year}`] = h[metric];
      }
    }
    return rows;
  }, [filteredData, metric]);

  const seriesList = useMemo(() => {
    const list: { writerId: number; name: string; year: string; colorIdx: number; dashIdx: number }[] = [];
    data.forEach((w, wi) => {
      years.forEach((year, yi) => {
        if (w.history.some((h) => h.periodKey.startsWith(year))) {
          list.push({ writerId: w.writerId, name: w.name, year, colorIdx: wi, dashIdx: yi });
        }
      });
    });
    return list;
  }, [data, years]);

  const hasEnoughTimelineData = timelineData.length >= 2;

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
          Writer Snapshot Trend
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

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((slot) => (
          <select
            key={slot}
            value={selected[slot]}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : "";
              setSelected((prev) => prev.map((v, i) => (i === slot ? val : v)));
            }}
            className="rounded border border-rule-strong bg-white px-2 py-1.5 text-xs outline-none focus:border-navy"
          >
            <option value="">{slot === 0 ? "Choose a writer…" : "Compare with…"}</option>
            {writers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name.toUpperCase()}
              </option>
            ))}
          </select>
        ))}
      </div>

      {allPoints.length > 2 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-soft uppercase tracking-wide">From</span>
          <select
            value={startKey}
            onChange={(e) => setStartKey(e.target.value)}
            className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
          >
            <option value="">Earliest</option>
            {[...new Map(allPoints.map((p) => [p.periodKey, p])).values()]
              .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
              .map((h) => (
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
            {[...new Map(allPoints.map((p) => [p.periodKey, p])).values()]
              .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
              .map((h) => (
                <option key={h.periodKey} value={h.periodKey}>
                  {h.periodLabel}
                </option>
              ))}
          </select>
        </div>
      )}

      {ids.length === 0 ? (
        <p className="text-xs italic text-ink-soft">Choose at least one writer above.</p>
      ) : loading ? (
        <p className="text-xs text-ink-soft">Loading…</p>
      ) : mode === "timeline" ? (
        !hasEnoughTimelineData ? (
          <p className="text-xs italic text-ink-soft">
            Need at least two months of data for the selected writer(s) in this range.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                  tickFormatter={(v) => metricDef.format(v)}
                />
                <Tooltip
                  formatter={(v: any, seriesKey: any) => {
                    const w = data.find((d) => `w${d.writerId}` === seriesKey);
                    return [metricDef.format(Number(v)), (w?.name ?? String(seriesKey)).toUpperCase()];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const w = data.find((d) => `w${d.writerId}` === value);
                    return (w?.name ?? value).toUpperCase();
                  }}
                />
                {data.map((w, i) => (
                  <Line
                    key={w.writerId}
                    type="monotone"
                    dataKey={`w${w.writerId}`}
                    name={`w${w.writerId}`}
                    stroke={WRITER_COLORS[i % WRITER_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearRows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                tickFormatter={(v) => metricDef.format(v)}
              />
              <Tooltip
                formatter={(v: any, seriesKey: any) => {
                  const [wKey, year] = String(seriesKey).split("::");
                  const w = data.find((d) => `w${d.writerId}` === wKey);
                  return [metricDef.format(Number(v)), `${(w?.name ?? wKey).toUpperCase()} (${year})`];
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const [wKey, year] = value.split("::");
                  const w = data.find((d) => `w${d.writerId}` === wKey);
                  return `${(w?.name ?? wKey).toUpperCase()} — ${year}`;
                }}
              />
              {seriesList.map((s) => (
                <Line
                  key={`${s.writerId}::${s.year}`}
                  type="monotone"
                  dataKey={`w${s.writerId}::${s.year}`}
                  name={`w${s.writerId}::${s.year}`}
                  stroke={WRITER_COLORS[s.colorIdx % WRITER_COLORS.length]}
                  strokeDasharray={YEAR_DASHES[s.dashIdx % YEAR_DASHES.length]}
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
