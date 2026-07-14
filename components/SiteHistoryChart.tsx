"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { HISTORY_METRICS, HistoryMetricKey } from "@/lib/historyMetrics";

type HistoryPoint = {
  periodKey: string;
  periodLabel: string;
  [key: string]: any;
  ranks: Record<string, { rank: number; total: number } | null>;
};

function RankDot(props: any) {
  const { cx, cy, payload, metricKey } = props;
  if (cx === undefined || cy === undefined) return null;
  const rankInfo = payload.ranks?.[metricKey];
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

  useEffect(() => {
    setLoading(true);
    fetch(`/api/depth-chart-writers/site/${siteId}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [siteId]);

  const metricDef = HISTORY_METRICS.find((m) => m.key === metric)!;

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
          Site Snapshot Trend
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
      {loading ? (
        <p className="text-xs text-ink-soft">Loading…</p>
      ) : history.length < 2 ? (
        <p className="text-xs italic text-ink-soft">
          Need at least two months of data to chart a trend.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
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
      )}
    </div>
  );
}
