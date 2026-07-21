"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
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
  const point = payload[0].payload as ScatterPoint & { x: number; y: number };
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
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
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
            <Scatter data={data} fill="var(--navy)" fillOpacity={0.65} />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
