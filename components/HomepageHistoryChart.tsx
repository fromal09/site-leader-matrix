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
import { formatCompactNumber } from "@/lib/trafficFormat";

type HistoryPoint = {
  periodLabel: string;
  homepagePageviews: number;
};

export function HomepageHistoryChart({ siteId }: { siteId: number }) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/depth-chart-writers/site/${siteId}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [siteId]);

  return (
    <div className="card rounded-md p-4">
      <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-navy">
        Homepage &amp; Site Pages Trend
      </h2>
      {loading ? (
        <p className="text-xs text-ink-soft">Loading…</p>
      ) : history.length < 2 ? (
        <p className="text-xs italic text-ink-soft">
          Need at least two months of data to chart a trend.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                tickFormatter={(v) => formatCompactNumber(v)}
              />
              <Tooltip formatter={(v: any) => formatCompactNumber(Number(v))} />
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
      )}
    </div>
  );
}
