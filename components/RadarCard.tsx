"use client";

import { useRouter } from "next/navigation";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { CATEGORIES } from "@/lib/categories";
import { average, gradeBand, BAND_COLORS } from "@/lib/grades";
import { GradeStamp } from "./GradeStamp";
import { slmLeaderHref } from "@/lib/routes";
import { useClickOrDoubleClick } from "@/lib/useClickOrDoubleClick";
import type { Site } from "@/lib/types";

export function RadarCard({
  site,
  sortKey = "overall",
}: {
  site: Site;
  sortKey?: "overall" | (typeof CATEGORIES)[number]["key"];
}) {
  const data = CATEGORIES.map((c) => {
    const row = site.scores.find((s) => s.category === c.key);
    return { subject: c.short, score: row?.score ?? 0, full: c.label };
  });
  const avg = average(site.scores.map((s) => s.score));
  const band = gradeBand(avg);
  const color = BAND_COLORS[band];
  const anyPlaceholder = site.scores.some((s) => !s.is_canonized);

  const isMetricSort = sortKey !== "overall";
  const activeCategory = CATEGORIES.find((c) => c.key === sortKey);
  const metricScore = isMetricSort
    ? site.scores.find((s) => s.category === sortKey)?.score ?? 0
    : avg;

  const router = useRouter();
  const clickHandlers = useClickOrDoubleClick(() => router.push(slmLeaderHref(site.id)));

  return (
    <div
      {...clickHandlers}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(slmLeaderHref(site.id));
      }}
      className="card group relative flex cursor-pointer flex-col rounded-md p-3 transition hover:-translate-y-0.5 hover:shadow-md"
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
        <div className="flex flex-col items-end">
          <GradeStamp
            avg={metricScore}
            size="sm"
            label={isMetricSort && activeCategory ? activeCategory.label : "Average"}
          />
          {isMetricSort && activeCategory && (
            <span className="mt-0.5 font-data text-[9px] uppercase tracking-wide text-ink-soft">
              {activeCategory.short}
            </span>
          )}
        </div>
      </div>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--rule-strong)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--ink-soft)", fontSize: 9 }}
            />
            <PolarRadiusAxis angle={90} domain={[0, 10]} tick={false} axisLine={false} />
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
    </div>
  );
}
