"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CATEGORIES } from "@/lib/categories";
import type { Site } from "@/lib/types";

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card max-w-xs rounded-md p-3 text-sm">
      <div className="font-display font-semibold text-navy">{d.full}</div>
      <div className="font-data text-lg text-ink">{d.score}/10</div>
      {d.note ? (
        <p className="mt-1 text-xs text-ink-soft">{d.note}</p>
      ) : (
        <p className="mt-1 text-xs italic text-ink-soft">No notes yet.</p>
      )}
    </div>
  );
}

export function RadarBig({ site, color }: { site: Site; color: string }) {
  const data = CATEGORIES.map((c) => {
    const row = site.scores.find((s) => s.category === c.key);
    return {
      subject: c.label,
      full: c.label,
      score: row?.score ?? 0,
      note: row?.note ?? "",
    };
  });

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--rule-strong)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink)", fontSize: 13 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tick={{ fill: "var(--ink-soft)", fontSize: 10 }}
          />
          <Radar
            dataKey="score"
            stroke={color}
            fill={color}
            fillOpacity={0.35}
            isAnimationActive={false}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
