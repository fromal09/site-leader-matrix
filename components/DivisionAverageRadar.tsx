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
import type { Site } from "@/lib/types";

export function DivisionAverageRadar({ sites }: { sites: Site[] }) {
  const data = CATEGORIES.map((c) => {
    const vals = sites
      .map((s) => s.scores.find((sc) => sc.category === c.key)?.score)
      .filter((v): v is number => v !== undefined);
    const avg = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : 0;
    return { subject: c.label, score: Number(avg.toFixed(2)) };
  });

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-navy">
          Division Average
        </h2>
        <span className="font-data text-xs text-ink-soft">
          n = {sites.length} sites
        </span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
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
              fill="var(--navy)"
              fillOpacity={0.3}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-data text-xs text-ink-soft sm:grid-cols-4">
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
