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
import { teamColor } from "@/lib/nflTeamColors";
import type { Site } from "@/lib/types";

function VertexDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={4.5} fill={payload.color} stroke="white" strokeWidth={1.5} />;
}

export function DivisionAverageRadar({ sites }: { sites: Site[] }) {
  const includedSites = sites.filter((s) => !s.excluded_from_aggregation);
  const excludedCount = sites.length - includedSites.length;

  const data = CATEGORIES.map((c) => {
    const vals = includedSites
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
    const ranked = includedSites
      .map((s) => {
        const sc = s.scores.find((row) => row.category === c.key)?.score;
        return sc !== undefined ? { site: s, score: sc } : null;
      })
      .filter((x): x is { site: Site; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { category: c, top: ranked };
  });

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-navy">Division Average</h2>
        <span className="font-data text-xs text-ink-soft">
          n = {includedSites.length} sites
          {excludedCount > 0 ? ` (${excludedCount} excluded)` : ""}
        </span>
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

        <div className="flex-1 space-y-2.5">
          <p className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
            Standouts
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {standouts.map(({ category, top }) => (
              <div key={category.key}>
                <div className="mb-1 font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  {category.label}
                </div>
                <div className="space-y-1">
                  {top.length === 0 ? (
                    <div className="text-xs italic text-ink-soft">—</div>
                  ) : (
                    top.map(({ site, score }, i) => {
                      const colors = teamColor(site.site_topic);
                      return (
                        <div
                          key={site.id}
                          className="flex items-center gap-1.5 rounded border bg-white py-1 pl-2 pr-1.5"
                          style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, borderColor: "var(--rule-strong)" }}
                        >
                          <span className="font-data text-[10px] text-ink-soft">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-navy">
                            {site.site_name}
                          </span>
                          <span
                            className="font-data text-[11px] font-semibold"
                            style={{ color: BAND_COLORS[gradeBand(score)] }}
                          >
                            {score.toFixed(1)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
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
