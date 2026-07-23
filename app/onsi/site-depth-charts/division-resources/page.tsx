"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ONSI_DC_BASE as DC_BASE } from "@/lib/onsiRoutes";
import { ResourceWritersBoard } from "@/components/ResourceWritersBoard";
import type { ResourceWriter } from "@/lib/resourceWriters";

const ROLES = ["Rover", "Staff Writer"] as const;

function DivisionResourcesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "NFL";

  const [role, setRole] = useState<(typeof ROLES)[number]>("Rover");
  const [writers, setWriters] = useState<ResourceWriter[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    fetch(
      `/api/onsi/depth-chart-writers/division-resources?roles=${encodeURIComponent(role)}&division=${encodeURIComponent(division)}`
    )
      .then((r) => r.json())
      .then((d) => {
        setWriters(d.writers ?? []);
        setPeriodLabel(d.selectedPeriod?.label ?? null);
      })
      .finally(() => setLoading(false));
  }, [role, division]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
          <h1 className="font-display text-3xl font-bold text-navy">
            {division} Division Resources
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex overflow-hidden rounded border border-navy">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className="px-3 py-1.5 text-xs font-medium"
                style={
                  role === r
                    ? { backgroundColor: "var(--navy)", color: "white" }
                    : { color: "var(--navy)" }
                }
              >
                {r}s
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResourceWritersBoard
        writers={writers}
        loading={loading}
        periodLabel={periodLabel}
        emptyText={`No ${role.toLowerCase()}s with matched traffic data yet in ${division}.`}
      />
    </main>
  );
}

export default function DivisionResourcesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-sm text-ink-soft">Loading…</p>
        </main>
      }
    >
      <DivisionResourcesInner />
    </Suspense>
  );
}
