"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DIVISIONS } from "@/lib/divisions";
import { formatCompactNumber, formatPercent } from "@/lib/trafficFormat";

type DivisionMetrics = {
  siteCount: number;
  articlesPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  pvPerPublishedArticle: number | null;
};

export default function HomePage() {
  const [byDivision, setByDivision] = useState<Record<string, DivisionMetrics>>({});
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/depth-chart-writers/all-sites-summary")
      .then((r) => r.json())
      .then((d) => {
        setByDivision(d.byDivision ?? {});
        setPeriodLabel(d.selectedPeriod?.label ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          FanSided Network
        </p>
        <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">
          Sports Directors Reference Guide
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          A field guide and toolset for evaluating and developing the people who run our
          sites — grading, planning, and tracking, across every division.
        </p>
        {periodLabel && (
          <p className="mt-1 font-data text-xs text-ink-soft">
            Traffic metrics below are for {periodLabel}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DIVISIONS.map((division) => {
          const metrics = byDivision[division.key];
          return division.status === "available" ? (
            <Link
              key={division.key}
              href={`/division/${division.key}`}
              className="card group flex flex-col rounded-md p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-navy">
                  {division.name}
                </h2>
                <span className="stamp h-9 w-9 shrink-0 text-[10px] text-grade-good">
                  GO
                </span>
              </div>
              {division.tagline && (
                <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                  {division.tagline}
                </p>
              )}

              {loading ? (
                <p className="mt-2 text-xs text-ink-soft">Loading…</p>
              ) : metrics ? (
                <div className="mt-2 grid grid-cols-2 gap-1 border-t border-rule pt-2">
                  <div className="font-data text-[10px] text-ink-soft">
                    <span className="font-semibold text-ink">
                      {metrics.articlesPublished}
                    </span>{" "}
                    published
                  </div>
                  <div className="font-data text-[10px] text-ink-soft">
                    <span className="font-semibold text-ink">
                      {formatCompactNumber(metrics.totalPageviews)}
                    </span>{" "}
                    PVs
                  </div>
                  <div className="font-data text-[10px] text-ink-soft">
                    <span className="font-semibold text-ink">
                      {formatCompactNumber(metrics.evergreenPageviews)}
                    </span>{" "}
                    evergreen
                  </div>
                  <div className="font-data text-[10px] text-ink-soft">
                    <span className="font-semibold text-ink">
                      {formatPercent(metrics.weightedAvgScrollDepth)}
                    </span>{" "}
                    scroll
                  </div>
                </div>
              ) : (
                <div className="mt-2 border-t border-rule pt-2 text-[10px] italic text-ink-soft">
                  No traffic data yet
                </div>
              )}

              <span className="mt-3 text-xs font-medium text-navy group-hover:underline">
                Open →
              </span>
            </Link>
          ) : (
            <div
              key={division.key}
              className="card relative flex flex-col rounded-md p-5 opacity-60"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-ink-soft">
                  {division.name}
                </h2>
                <span className="stamp h-9 w-9 shrink-0 text-[9px] text-ink-soft">
                  SOON
                </span>
              </div>
              {division.tagline && (
                <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                  {division.tagline}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
