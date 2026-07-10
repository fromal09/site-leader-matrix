"use client";

import { useEffect, useMemo, useState } from "react";
import { RadarCard } from "@/components/RadarCard";
import { DivisionAverageRadar } from "@/components/DivisionAverageRadar";
import { TrendsPanel } from "@/components/TrendsPanel";
import { CanonizeButton } from "@/components/CanonizeButton";
import { CATEGORIES } from "@/lib/categories";
import { average } from "@/lib/grades";
import type { Site } from "@/lib/types";

type SortKey = "overall" | (typeof CATEGORIES)[number]["key"];

export default function HomePage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("overall");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sites");
    const data = await res.json();
    setSites(data.sites ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            Division Overview
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">
            NFL Site Leader Grades
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <CanonizeButton count={placeholderCount} onDone={load} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading the grade book…</p>
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
