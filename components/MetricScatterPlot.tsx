"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type ScatterAxisOption = {
  key: string;
  label: string;
  accessor: (item: any) => number | null;
  format: (v: number) => string;
};

export type ScatterPoint = {
  id: number | string;
  name: string;
  subtitle?: string;
  raw: any;
};

// Ordinary least-squares fit — the standard "best fit line" through a set
// of (x, y) points, minimizing the sum of squared vertical distances.
function computeLinearRegression(
  points: { x: number; y: number }[]
): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null; // all points share the same x — no meaningful slope
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function CustomTooltip({
  active,
  payload,
  xOption,
  yOption,
}: {
  active?: boolean;
  payload?: any[];
  xOption: ScatterAxisOption;
  yOption: ScatterAxisOption;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as (ScatterPoint & { x: number; y: number }) | undefined;
  if (!point || !point.name) return null; // trendline point, not a data point — skip
  return (
    <div className="rounded border border-rule-strong bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-display font-semibold text-navy">{point.name}</div>
      {point.subtitle && <div className="font-data text-[10px] text-ink-soft">{point.subtitle}</div>}
      <div className="mt-1 font-data">
        {xOption.label}: <strong>{xOption.format(point.x)}</strong>
      </div>
      <div className="font-data">
        {yOption.label}: <strong>{yOption.format(point.y)}</strong>
      </div>
    </div>
  );
}

export function MetricScatterPlot({
  title,
  points,
  axisOptions,
  defaultXKey,
  defaultYKey,
}: {
  title: string;
  points: ScatterPoint[];
  axisOptions: ScatterAxisOption[];
  defaultXKey: string;
  defaultYKey: string;
}) {
  const [xKey, setXKey] = useState(defaultXKey);
  const [yKey, setYKey] = useState(defaultYKey);

  const xOption = axisOptions.find((o) => o.key === xKey) ?? axisOptions[0];
  const yOption = axisOptions.find((o) => o.key === yKey) ?? axisOptions[1] ?? axisOptions[0];

  const data = useMemo(() => {
    return points
      .map((p) => {
        const x = xOption.accessor(p.raw);
        const y = yOption.accessor(p.raw);
        if (x === null || y === null) return null;
        return { ...p, x, y };
      })
      .filter((p): p is ScatterPoint & { x: number; y: number } => p !== null);
  }, [points, xOption, yOption]);

  const trendData = useMemo(() => {
    const fit = computeLinearRegression(data.map((d) => ({ x: d.x, y: d.y })));
    if (!fit) return null;
    const xs = data.map((d) => d.x);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    return [
      { x: xMin, y: fit.slope * xMin + fit.intercept },
      { x: xMax, y: fit.slope * xMax + fit.intercept },
    ];
  }, [data]);

  return (
    <div className="card rounded-md p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-ink-soft uppercase tracking-wide">X</span>
            <select
              value={xKey}
              onChange={(e) => setXKey(e.target.value)}
              className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
            >
              {axisOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-ink-soft uppercase tracking-wide">Y</span>
            <select
              value={yKey}
              onChange={(e) => setYKey(e.target.value)}
              className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
            >
              {axisOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm italic text-ink-soft">
          Nothing to plot for this combination yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={xOption.label}
              tickFormatter={xOption.format}
              tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
              stroke="var(--rule-strong)"
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yOption.label}
              tickFormatter={yOption.format}
              tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
              stroke="var(--rule-strong)"
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={<CustomTooltip xOption={xOption} yOption={yOption} />}
            />
            {trendData && (
              <Line
                data={trendData}
                dataKey="y"
                stroke="var(--grease-red)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
                tooltipType="none"
              />
            )}
            <Scatter data={data} fill="var(--navy)" fillOpacity={0.65} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
