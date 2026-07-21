"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DivisionMetrics = {
  siteCount: number;
  articlesPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
};

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function OnsiHomePage() {
  const [sites, setSites] = useState<{ id: number; division: string }[]>([]);
  const [byDivision, setByDivision] = useState<Record<string, DivisionMetrics>>({});
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/onsi/sites").then((r) => r.json()),
      fetch("/api/onsi/depth-chart-writers/all-sites-summary").then((r) => r.json()),
    ])
      .then(([sitesRes, summaryRes]) => {
        setSites(sitesRes.sites ?? []);
        setByDivision(summaryRes.byDivision ?? {});
        setPeriodLabel(summaryRes.selectedPeriod?.label ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const divisions = Array.from(new Set(sites.map((s) => s.division))).sort();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">OnSI Network</p>
        <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">
          OnSI Directors Reference Guide
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Site depth charts and traffic performance across the OnSI network. Double-click
          anywhere on the page to pin a note for the team.
        </p>
        {periodLabel && (
          <p className="mt-1 font-data text-xs text-ink-soft">
            Traffic metrics below are for {periodLabel}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : divisions.length === 0 ? (
        <p className="text-sm italic text-ink-soft">
          No sites set up yet. Once divisions and sites are added, they&apos;ll show up here.
        </p>
      ) : (
        <>
          <Link
            href="/onsi/site-depth-charts?division=ALL"
            className="group mb-4 flex flex-col gap-3 rounded-md border-2 border-navy p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "linear-gradient(135deg, var(--navy), var(--navy-soft))" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold">Full OnSI</h2>
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-data text-[10px] uppercase tracking-wide">
                  Network-Wide
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Every site, every division, in one combined view — same tools, no division
                filter.
              </p>
            </div>
            {(() => {
              const totals = Object.values(byDivision).reduce(
                (acc, m) => ({
                  articlesPublished: acc.articlesPublished + m.articlesPublished,
                  totalPageviews: acc.totalPageviews + m.totalPageviews,
                }),
                { articlesPublished: 0, totalPageviews: 0 }
              );
              return (
                <div className="flex gap-6 font-data text-sm">
                  <div>
                    <div className="text-white/60">Published</div>
                    <div className="text-lg font-semibold">
                      {totals.articlesPublished.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60">Total PVs</div>
                    <div className="text-lg font-semibold">
                      {formatCompact(totals.totalPageviews)}
                    </div>
                  </div>
                </div>
              );
            })()}
            <span className="shrink-0 text-sm font-medium text-white group-hover:underline">
              Open →
            </span>
          </Link>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {divisions.map((division) => {
              const metrics = byDivision[division];
              return (
                <Link
                  key={division}
                  href={`/onsi/site-depth-charts?division=${encodeURIComponent(division)}`}
                  className="card group flex flex-col rounded-md p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="font-display text-xl font-semibold text-navy">{division}</h2>
                    <span className="stamp h-9 w-9 shrink-0 text-[10px] text-grade-good">GO</span>
                  </div>
                  {metrics ? (
                    <div className="mt-2 grid grid-cols-2 gap-1 border-t border-rule pt-2">
                      <div className="font-data text-[10px] text-ink-soft">
                        <span className="font-semibold text-ink">{metrics.articlesPublished}</span> published
                      </div>
                      <div className="font-data text-[10px] text-ink-soft">
                        <span className="font-semibold text-ink">
                          {formatCompact(metrics.totalPageviews)}
                        </span>{" "}
                        PVs
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
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
