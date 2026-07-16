"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIVISIONS } from "@/lib/divisions";
import { formatCompactNumber, formatPercent } from "@/lib/trafficFormat";
import { useStickyNotes } from "@/lib/stickyNotes";
import { StickyBoard } from "@/components/StickyBoard";
import { useClickOrDoubleClick } from "@/lib/useClickOrDoubleClick";

type DivisionMetrics = {
  siteCount: number;
  articlesPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  pvPerPublishedArticle: number | null;
};

function DivisionCard({
  division,
  metrics,
  loading,
}: {
  division: (typeof DIVISIONS)[number];
  metrics: DivisionMetrics | undefined;
  loading: boolean;
}) {
  const router = useRouter();
  const clickHandlers = useClickOrDoubleClick(() => router.push(`/division/${division.key}`));

  return (
    <div
      {...clickHandlers}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/division/${division.key}`);
      }}
      className="card group flex cursor-pointer flex-col rounded-md p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-navy">{division.name}</h2>
        <span className="stamp h-9 w-9 shrink-0 text-[10px] text-grade-good">GO</span>
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
            <span className="font-semibold text-ink">{metrics.articlesPublished}</span> published
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

      <span className="mt-3 text-xs font-medium text-navy group-hover:underline">Open →</span>
    </div>
  );
}

export default function HomePage() {
  const [byDivision, setByDivision] = useState<Record<string, DivisionMetrics>>({});
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // One shared canvas for the whole page — notes aren't tied to a specific
  // division, they just live wherever you drop them.
  const { notesFor, addNote, removeNote, updatePosition } = useStickyNotes("page", ["home"]);

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
    <StickyBoard
      notes={notesFor("home")}
      onAdd={(body, color, x, y) => addNote("home", body, color, null, x, y)}
      onRemove={removeNote}
      onUpdatePosition={updatePosition}
    >
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
            sites — grading, planning, and tracking, across every division. Double-click
            anywhere on the page to pin a note for the team, then drag it wherever it's
            most useful.
          </p>
          {periodLabel && (
            <p className="mt-1 font-data text-xs text-ink-soft">
              Traffic metrics below are for {periodLabel}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIVISIONS.map((division) =>
            division.status === "available" ? (
              <DivisionCard
                key={division.key}
                division={division}
                metrics={byDivision[division.key]}
                loading={loading}
              />
            ) : (
              <div
                key={division.key}
                className="card relative flex flex-col rounded-md p-5 opacity-60"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold text-ink-soft">
                    {division.name}
                  </h2>
                  <span className="stamp h-9 w-9 shrink-0 text-[9px] text-ink-soft">SOON</span>
                </div>
                {division.tagline && (
                  <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                    {division.tagline}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </main>
    </StickyBoard>
  );
}
