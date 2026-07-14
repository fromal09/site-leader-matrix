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
import type { DepthChartWriter } from "@/lib/depthCharts";

const LINE_COLORS = ["var(--navy)", "var(--grade-good)", "var(--grease-red)"];

type WriterHistory = {
  writerId: number;
  name: string;
  history: { periodKey: string; periodLabel: string; [key: string]: any }[];
};

export function WriterHistoryChart({ writers }: { writers: DepthChartWriter[] }) {
  const [selected, setSelected] = useState<(number | "")[]>([writers[0]?.id ?? "", "", ""]);
  const [metric, setMetric] = useState<HistoryMetricKey>("totalPageviews");
  const [data, setData] = useState<WriterHistory[]>([]);
  const [loading, setLoading] = useState(false);

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
      .then((d) => setData(d.writers ?? []))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const metricDef = HISTORY_METRICS.find((m) => m.key === metric)!;

  const chartData = useMemo(() => {
    const periodMap = new Map<string, any>();
    for (const w of data) {
      for (const h of w.history) {
        if (!periodMap.has(h.periodKey)) {
          periodMap.set(h.periodKey, { periodKey: h.periodKey, periodLabel: h.periodLabel });
        }
        periodMap.get(h.periodKey)[`w${w.writerId}`] = h[metric];
      }
    }
    return Array.from(periodMap.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [data, metric]);

  const hasEnoughData = chartData.length >= 2;

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
          Writer Snapshot Trend
        </h2>
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
                {w.name}
              </option>
            ))}
          </select>
        ))}
      </div>

      {ids.length === 0 ? (
        <p className="text-xs italic text-ink-soft">Choose at least one writer above.</p>
      ) : loading ? (
        <p className="text-xs text-ink-soft">Loading…</p>
      ) : !hasEnoughData ? (
        <p className="text-xs italic text-ink-soft">
          Need at least two months of data for the selected writer(s) to chart a trend.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                tickFormatter={(v) => metricDef.format(v)}
              />
              <Tooltip
                formatter={(v: any, seriesKey: any) => {
                  const w = data.find((d) => `w${d.writerId}` === seriesKey);
                  return [metricDef.format(Number(v)), w?.name ?? seriesKey];
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const w = data.find((d) => `w${d.writerId}` === value);
                  return w?.name ?? value;
                }}
              />
              {data.map((w, i) => (
                <Line
                  key={w.writerId}
                  type="monotone"
                  dataKey={`w${w.writerId}`}
                  name={`w${w.writerId}`}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
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
