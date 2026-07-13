"use client";

import Link from "next/link";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { CATEGORIES } from "@/lib/categories";
import { average, gradeBand, BAND_COLORS } from "@/lib/grades";
import { GradeStamp } from "./GradeStamp";
import { slmLeaderHref } from "@/lib/routes";
import type { Site } from "@/lib/types";

export function RadarCard({ site }: { site: Site }) {
  const data = CATEGORIES.map((c) => {
    const row = site.scores.find((s) => s.category === c.key);
    return { subject: c.short, score: row?.score ?? 0, full: c.label };
  });
  const avg = average(site.scores.map((s) => s.score));
  const band = gradeBand(avg);
  const color = BAND_COLORS[band];
  const anyPlaceholder = site.scores.some((s) => !s.is_canonized);

  return (
    <Link
      href={slmLeaderHref(site.id)}
      className="card group relative flex flex-col rounded-md p-3 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {anyPlaceholder && (
        <span className="absolute right-2 top-2 rounded-full bg-grease-red/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-grease-red">
          placeholder
        </span>
      )}
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold text-navy">
            {site.site_name}
          </div>
          <div className="truncate text-xs text-ink-soft">{site.site_topic}</div>
        </div>
        <GradeStamp avg={avg} size="sm" />
      </div>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--rule-strong)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--ink-soft)", fontSize: 9 }}
            />
            <Radar
              dataKey="score"
              stroke={color}
              fill={color}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 truncate font-data text-[11px] text-ink-soft">
        {site.leader_name}
      </div>
    </Link>
  );
}
