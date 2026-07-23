"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ResourceWritersBoard } from "@/components/ResourceWritersBoard";
import type { ResourceWriter } from "@/lib/resourceWriters";

const FTE_ROLES = ["Staff Writer", "Site Editor"];
const ALL_DIVISIONS = "__all__";

export default function FtePage() {
  const [division, setDivision] = useState<string>(ALL_DIVISIONS);
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
    const params = new URLSearchParams({ roles: FTE_ROLES.join(",") });
    if (division !== ALL_DIVISIONS) params.set("division", division);
    fetch(`/api/onsi/depth-chart-writers/division-resources?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setWriters(d.writers ?? []);
        setPeriodLabel(d.selectedPeriod?.label ?? null);
      })
      .finally(() => setLoading(false));
  }, [division]);

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
          <h1 className="font-display text-3xl font-bold text-navy">FTE Report</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Aggregate work from every Staff Writer and Site Editor — the two roles that
            represent full-time staff rather than freelance contributors — with a
            site-by-site breakdown for each person.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-ink-soft uppercase tracking-wide">Division</span>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="rounded border border-rule-strong bg-white px-2 py-1 font-data text-xs"
          >
            <option value={ALL_DIVISIONS}>All Divisions</option>
            {availableDivisions.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ResourceWritersBoard
        writers={writers}
        loading={loading}
        periodLabel={periodLabel}
        emptyText="No Staff Writers or Site Editors with matched traffic data yet."
        showDivisionColumn={division === ALL_DIVISIONS}
      />
    </main>
  );
}
