"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Site = {
  id: number;
  site_name: string;
  site_topic: string;
  leader_name: string;
  division: string;
};

function HubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "";

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/onsi/sites")
      .then((r) => r.json())
      .then((d) => setSites(d.sites ?? []))
      .finally(() => setLoading(false));
  }, []);

  const allDivisions = Array.from(new Set(sites.map((s) => s.division))).sort();
  const activeDivision = division || allDivisions[0] || "";
  const filtered = activeDivision === "ALL" ? sites : sites.filter((s) => s.division === activeDivision);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/onsi" className="text-xs font-medium text-ink-soft hover:text-navy">
        ← All Divisions
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            Division Overview
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">
            {activeDivision === "ALL" ? "All Divisions" : activeDivision || "OnSI"} Site Depth Charts and Performance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Click into any site to build out its writer roster.
          </p>
        </div>
        {allDivisions.length > 1 && (
          <label className="flex items-center gap-2 text-xs">
            <span className="text-ink-soft uppercase tracking-wide">Division</span>
            <select
              value={activeDivision}
              onChange={(e) => router.push(`?division=${e.target.value}`)}
              className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
            >
              {allDivisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="ALL">All Divisions</option>
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm italic text-ink-soft">No sites in this division yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((site) => (
            <Link
              key={site.id}
              href={`/onsi/site-depth-charts/${site.id}`}
              className="card rounded-md p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="font-display text-lg font-semibold text-navy">{site.site_name}</div>
              <div className="text-xs text-ink-soft">{site.site_topic}</div>
              <div className="mt-2 font-data text-[11px] text-ink-soft">
                Leader: {site.leader_name}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export default function OnsiHubPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-sm text-ink-soft">Loading…</p>
        </main>
      }
    >
      <HubInner />
    </Suspense>
  );
}
