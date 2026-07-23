"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ResourceWritersBoard } from "@/components/ResourceWritersBoard";
import type { ResourceWriter } from "@/lib/resourceWriters";

const ROLES = ["Rover", "Staff Writer"] as const;

export default function NetworkWritersPage() {
  const [role, setRole] = useState<(typeof ROLES)[number]>("Rover");
  const [writers, setWriters] = useState<ResourceWriter[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/onsi/depth-chart-writers/division-resources?roles=${encodeURIComponent(role)}`)
      .then((r) => r.json())
      .then((d) => {
        setWriters(d.writers ?? []);
        setPeriodLabel(d.selectedPeriod?.label ?? null);
      })
      .finally(() => setLoading(false));
  }, [role]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/onsi" className="text-xs font-medium text-ink-soft hover:text-navy">
        ← All Divisions
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            OnSI Network
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">Network Writers</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Rovers and Staff Writers across every division, combined — the same person's
            work on an NFL site and an NBA site rolls up together here, so you can see
            everything someone like Chris Schad is producing network-wide, not just within
            one division.
          </p>
        </div>
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

      <ResourceWritersBoard
        writers={writers}
        loading={loading}
        periodLabel={periodLabel}
        emptyText={`No ${role.toLowerCase()}s with matched traffic data yet.`}
        showDivisionColumn
      />
    </main>
  );
}
