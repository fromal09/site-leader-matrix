"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RadarCard } from "@/components/RadarCard";
import { DivisionAverageRadar } from "@/components/DivisionAverageRadar";
import { TrendsPanel } from "@/components/TrendsPanel";
import { CanonizeButton } from "@/components/CanonizeButton";
import { CATEGORIES } from "@/lib/categories";
import { average } from "@/lib/grades";
import { DIVISIONS } from "@/lib/divisions";
import type { Site } from "@/lib/types";

type SortKey = "overall" | (typeof CATEGORIES)[number]["key"];

export default function SiteLeaderMatrixPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><p className="text-sm text-ink-soft">Loading…</p></main>}>
      <SiteLeaderMatrixInner />
    </Suspense>
  );
}

function SiteLeaderMatrixInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "NFL";

  const [allSites, setAllSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("overall");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sites");
    const data = await res.json();
    setAllSites(data.sites ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const sites = useMemo(
    () => allSites.filter((s) => (s.division ?? "NFL") === division),
    [allSites, division]
  );

  const placeholderCount = useMemo(
    () => sites.reduce((n, s) => n + s.scores.filter((sc) => !sc.is_canonized).length, 0),
    [sites]
  );

  const sortedSites = useMemo(() => {
    const copy = [...sites];
    copy.sort((a, b) => {
      const va =
        sortKey === "overall"
          ? average(a.scores.map((s) => s.score))
          : a.scores.find((s) => s.category === sortKey)?.score ?? 0;
      const vb =
        sortKey === "overall"
          ? average(b.scores.map((s) => s.score))
          : b.scores.find((s) => s.category === sortKey)?.score ?? 0;
      return vb - va;
    });
    return copy;
  }, [sites, sortKey]);

  const availableDivisions = DIVISIONS.filter((d) => d.status === "available");

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            Division Overview
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">
            {division} Site Leader Grades
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {availableDivisions.length > 1 && (
            <label className="flex items-center gap-2 text-xs">
              <span className="text-ink-soft uppercase tracking-wide">Division</span>
              <select
                value={division}
                onChange={(e) => router.push(`?division=${e.target.value}`)}
                className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
              >
                {availableDivisions.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <CanonizeButton count={placeholderCount} onDone={load} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading the grade book…</p>
      ) : sites.length === 0 ? (
        <p className="text-sm italic text-ink-soft">
          No {division} sites seeded yet.
        </p>
      ) : (
        <>
          <div className="mb-6">
            <DivisionAverageRadar sites={sites} />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-navy">All Sites</h2>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-ink-soft uppercase tracking-wide">Sort by</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
              >
                <option value="overall">Overall average</option>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedSites.map((site) => (
              <RadarCard key={site.id} site={site} />
            ))}
          </div>

          <div className="mt-8">
            <TrendsPanel sites={sites} />
          </div>
        </>
      )}
    </main>
  );
}
