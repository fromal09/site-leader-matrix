"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WriterCard } from "@/components/WriterCard";
import { useAuth } from "@/components/AuthProvider";
import { DC_BASE } from "@/lib/routes";
import type { DepthChartRole, DepthChartWriter } from "@/lib/depthCharts";
import type { Site } from "@/lib/types";

export default function DepthChartSitePage() {
  const params = useParams();
  const id = Number(params.id);
  const { requireAuth } = useAuth();

  const [site, setSite] = useState<Site | null>(null);
  const [writers, setWriters] = useState<DepthChartWriter[]>([]);
  const [roles, setRoles] = useState<DepthChartRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [siteRes, writersRes, rolesRes] = await Promise.all([
      fetch(`/api/sites/${id}`).then((r) => r.json()),
      fetch(`/api/depth-chart-writers/${id}`).then((r) => r.json()),
      fetch("/api/depth-chart-roles").then((r) => r.json()),
    ]);
    setSite(siteRes.site ?? null);
    setWriters(writersRes.writers ?? []);
    setRoles(rolesRes.roles ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function handleAddClick() {
    if (!requireAuth()) return;
    setAddingNew(true);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p className="text-sm text-ink-soft">Loading roster…</p>
      </main>
    );
  }

  if (!site) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p className="text-sm text-grade-low">Site not found.</p>
        <Link href={DC_BASE} className="text-sm text-navy hover:underline">
          Back to all sites
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link href={DC_BASE} className="text-xs font-medium text-ink-soft hover:text-navy">
        ← All sites
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            {site.site_topic}
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">{site.site_name}</h1>
          <p className="text-sm text-ink-soft">Site leader: {site.leader_name}</p>
        </div>
        {!addingNew && (
          <button
            onClick={handleAddClick}
            className="rounded bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-soft"
          >
            + Add Writer
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {addingNew && (
          <WriterCard
            siteId={site.id}
            writer={null}
            roles={roles}
            onRoleCreated={(r) => setRoles((prev) => [...prev, r])}
            onSaved={() => {
              setAddingNew(false);
              load();
            }}
            onDiscardNew={() => setAddingNew(false)}
          />
        )}
        {writers.map((w) => (
          <WriterCard
            key={w.id}
            siteId={site.id}
            writer={w}
            roles={roles}
            onRoleCreated={(r) => setRoles((prev) => [...prev, r])}
            onSaved={load}
            onDiscardNew={() => {}}
          />
        ))}
      </div>

      {writers.length === 0 && !addingNew && (
        <p className="mt-4 text-sm italic text-ink-soft">
          No writers on this roster yet — add the first one above.
        </p>
      )}
    </main>
  );
}
