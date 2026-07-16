"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { CATEGORIES } from "@/lib/categories";
import { gradeBand, BAND_COLORS } from "@/lib/grades";
import { GradeStamp } from "./GradeStamp";
import type { Site } from "@/lib/types";

function VertexDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={4.5} fill={payload.color} stroke="white" strokeWidth={1.5} />;
}

export function DivisionAverageRadar({ sites }: { sites: Site[] }) {
  const data = CATEGORIES.map((c) => {
    const vals = sites
      .map((s) => s.scores.find((sc) => sc.category === c.key)?.score)
      .filter((v): v is number => v !== undefined);
    const avg = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : 0;
    return {
      subject: c.label,
      score: Number(avg.toFixed(2)),
      color: BAND_COLORS[gradeBand(avg)],
    };
  });

  const standouts = CATEGORIES.map((c) => {
    let best: { site: Site; score: number } | null = null;
    for (const s of sites) {
      const sc = s.scores.find((row) => row.category === c.key)?.score;
      if (sc !== undefined && (!best || sc > best.score)) best = { site: s, score: sc };
    }
    return { category: c, best };
  });

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-navy">Division Average</h2>
        <span className="font-data text-xs text-ink-soft">n = {sites.length} sites</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="h-72 w-full lg:w-[46%] lg:shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="75%">
              <defs>
                <linearGradient id="divisionRadarFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--navy)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--grade-good)" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="var(--rule-strong)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink)", fontSize: 12 }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tick={{ fill: "var(--ink-soft)", fontSize: 10 }}
              />
              <Radar
                dataKey="score"
                stroke="var(--navy)"
                strokeWidth={2}
                fill="url(#divisionRadarFill)"
                fillOpacity={1}
                dot={<VertexDot />}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-1.5">
          <p className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
            Standouts
          </p>
          {standouts.map(({ category, best }) => (
            <div
              key={category.key}
              className="flex items-center justify-between gap-2 rounded border border-rule-strong bg-white px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  {category.label}
                </div>
                <div className="truncate text-sm font-medium text-navy">
                  {best?.site.site_name ?? "—"}
                </div>
              </div>
              {best && <GradeStamp avg={best.score} size="sm" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-data text-xs text-ink-soft sm:grid-cols-4">
        {data.map((d) => (
          <div key={d.subject} className="flex justify-between">
            <span>{d.subject}</span>
            <span className="text-ink">{d.score.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
