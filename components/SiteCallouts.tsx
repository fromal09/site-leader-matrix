"use client";

import Link from "next/link";
import { computeWriterObservations } from "@/lib/observations";
import { writerTrafficHref } from "@/lib/routes";
import type { DepthChartWriter } from "@/lib/depthCharts";
import type { SiteTrafficTotals, WriterQuickStats } from "@/lib/traffic";

type NamedWriter = { id: number; name: string };

function CalloutRow({
  label,
  color,
  writers,
  emptyText,
}: {
  label: string;
  color: string;
  writers: NamedWriter[];
  emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-data text-[11px] uppercase tracking-wide text-ink-soft">
          {label}
        </span>
      </div>
      {writers.length === 0 ? (
        <p className="mt-0.5 text-sm italic text-ink-soft">{emptyText}</p>
      ) : (
        <p className="mt-0.5 text-sm text-ink">
          {writers.map((w, i) => (
            <span key={w.id}>
              <Link href={writerTrafficHref(w.id)} className="text-navy hover:underline">
                {w.name}
              </Link>
              {i < writers.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function SiteCallouts({
  writers,
  quickStats,
  siteTotals,
  periodLabel,
}: {
  writers: DepthChartWriter[];
  quickStats: Record<number, WriterQuickStats>;
  siteTotals: SiteTrafficTotals | null;
  periodLabel: string | null;
}) {
  if (!siteTotals) return null;

  const withStats = writers
    .map((w) => ({ writer: w, stats: quickStats[w.id] }))
    .filter((x): x is { writer: DepthChartWriter; stats: WriterQuickStats } => Boolean(x.stats));

  if (withStats.length === 0) return null;

  const mainDriver = [...withStats].sort(
    (a, b) => b.stats.totalPageviews - a.stats.totalPageviews
  )[0];

  const homeRunHitters: NamedWriter[] = [];
  const needsImprovement: NamedWriter[] = [];
  const engagementHeroes: NamedWriter[] = [];
  const thinContent: NamedWriter[] = [];

  for (const { writer, stats } of withStats) {
    const obs = computeWriterObservations(
      {
        weightedAvgScrollDepth: stats.weightedAvgScrollDepth,
        pvPerPublishedArticle: stats.pvPerPublishedArticle,
        weightedAvgTimeOnPage: stats.weightedAvgTimeOnPage,
      },
      {
        weightedAvgScrollDepth: siteTotals.weightedAvgScrollDepth,
        pvPerPublishedArticle: siteTotals.pvPerPublishedArticle,
        weightedAvgTimeOnPage: siteTotals.weightedAvgTimeOnPage,
      }
    );

    const pvObs = obs.find((o) => o.key === "pvPerArticle");
    if (pvObs && stats.articlesPublished >= 3) {
      if (pvObs.direction === "above") homeRunHitters.push({ id: writer.id, name: writer.name });
      else needsImprovement.push({ id: writer.id, name: writer.name });
    }

    const scrollObs = obs.find((o) => o.key === "scroll");
    const timeObs = obs.find((o) => o.key === "timeOnPage");
    if (scrollObs?.direction === "above" || timeObs?.direction === "above") {
      engagementHeroes.push({ id: writer.id, name: writer.name });
    }
    if (scrollObs?.direction === "below" || timeObs?.direction === "below") {
      thinContent.push({ id: writer.id, name: writer.name });
    }
  }

  return (
    <div className="card mb-6 rounded-md p-4">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-navy">
        Callouts{periodLabel ? ` — ${periodLabel}` : ""}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-grade-good">
            The Good
          </p>
          <div className="space-y-3">
            <CalloutRow
              label="Main Traffic-Driver"
              color="var(--navy)"
              writers={
                mainDriver ? [{ id: mainDriver.writer.id, name: mainDriver.writer.name }] : []
              }
              emptyText="No data yet"
            />
            <CalloutRow
              label="Home-Run Hitters"
              color="var(--grade-good)"
              writers={homeRunHitters}
              emptyText="None this period"
            />
            <CalloutRow
              label="Engagement Heroes"
              color="var(--grade-good)"
              writers={engagementHeroes}
              emptyText="None this period"
            />
          </div>
        </div>
        <div>
          <p className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-grade-low">
            The Bad
          </p>
          <div className="space-y-3">
            <CalloutRow
              label="Needs Packaging / Topic Improvements"
              color="var(--grade-low)"
              writers={needsImprovement}
              emptyText="None this period"
            />
            <CalloutRow
              label="Thin Content Concerns"
              color="var(--grade-low)"
              writers={thinContent}
              emptyText="None this period"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
