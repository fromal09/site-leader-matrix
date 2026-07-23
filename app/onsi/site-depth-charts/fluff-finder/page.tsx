"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ONSI_DC_BASE as DC_BASE } from "@/lib/onsiRoutes";
import { FluffFinderPanel, type FluffFinderWriterOption } from "@/components/FluffFinderPanel";

function DivisionFluffFinderInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "NFL";

  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FluffFinderWriterOption[]>([]);
  const [availableDivisions, setAvailableDivisions] = useState<{ key: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/onsi/sites")
      .then((r) => r.json())
      .then((d) => {
        const divisions = Array.from(new Set((d.sites ?? []).map((s: any) => s.division))).sort();
        setAvailableDivisions(divisions.map((key) => ({ key: key as string, name: key as string })));
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/onsi/depth-chart-writers/division-delta?division=${encodeURIComponent(division)}`)
      .then((r) => r.json())
      .then((d) => {
        const writers = (d.allWriters ?? []) as any[];
        setOptions(
          writers
            .filter((w) => w.current.articlesPublished > 0)
            .map(
              (w): FluffFinderWriterOption => ({
                writerId: w.writerId,
                siteId: w.siteId,
                label: `${w.name} (${w.siteName})`,
                articlesPublished: w.current.articlesPublished,
              })
            )
        );
      })
      .finally(() => setLoading(false));
  }, [division]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href={`${DC_BASE}?division=${division}`}
        className="text-xs font-medium text-ink-soft hover:text-navy"
      >
        ← All sites
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            Site Depth Charts and Performance
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">{division} Fluff Finder</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Pick any writer across the division to see where their current-month traffic
            stops meaningfully growing.
          </p>
        </div>
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
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <FluffFinderPanel writerOptions={options} apiPrefix="/onsi" />
      )}
    </main>
  );
}

export default function DivisionFluffFinderPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <p className="text-sm text-ink-soft">Loading…</p>
        </main>
      }
    >
      <DivisionFluffFinderInner />
    </Suspense>
  );
}
