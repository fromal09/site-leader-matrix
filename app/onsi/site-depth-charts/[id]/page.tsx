"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type Site = {
  id: number;
  site_name: string;
  site_topic: string;
  leader_name: string;
  division: string;
};

type Writer = {
  id: number;
  site_id: number;
  name: string;
  role: string;
  traffic_dashboard_name: string;
};

type Role = { id: number; label: string; section: string };

type WriterStats = {
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

type TrafficSummary = {
  periodLabel: string | null;
  writers: Record<number, WriterStats>;
  siteTotals: {
    articlesPublished: number;
    totalPageviews: number;
    evergreenPageviews: number;
    weightedAvgScrollDepth: number | null;
    weightedAvgTimeOnPage: number | null;
  } | null;
};

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function formatPercent(v: number | null) {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}
function formatDuration(v: number | null) {
  if (v === null) return "—";
  const m = Math.floor(v / 60);
  const s = Math.round(v % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function OnsiRosterPage() {
  const params = useParams();
  const siteId = Number(params.id);
  const { requireAuth, session } = useAuth();

  const [site, setSite] = useState<Site | null>(null);
  const [writers, setWriters] = useState<Writer[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [traffic, setTraffic] = useState<TrafficSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDashboardName, setNewDashboardName] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/onsi/sites/${siteId}`).then((r) => r.json()),
      fetch(`/api/onsi/depth-chart-writers/${siteId}`).then((r) => r.json()),
      fetch("/api/onsi/depth-chart-roles").then((r) => r.json()),
      fetch(`/api/onsi/depth-chart-writers/site/${siteId}/traffic-summary`).then((r) => r.json()),
    ])
      .then(([siteRes, writersRes, rolesRes, trafficRes]) => {
        setSite(siteRes.site ?? null);
        setWriters(writersRes.writers ?? []);
        setRoles(rolesRes.roles ?? []);
        setTraffic(trafficRes);
        if (!newRole && rolesRes.roles?.[0]) setNewRole(rolesRes.roles[0].label);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function addWriter() {
    if (!requireAuth()) return;
    if (!newName.trim() || !newRole) return;
    setBusy(true);
    await fetch(`/api/onsi/depth-chart-writers/${siteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, role: newRole, trafficDashboardName: newDashboardName }),
    });
    setBusy(false);
    setNewName("");
    setNewDashboardName("");
    setAddingNew(false);
    load();
  }

  async function removeWriter(id: number) {
    if (!requireAuth()) return;
    if (!window.confirm("Remove this writer from the roster?")) return;
    await fetch(`/api/onsi/depth-chart-writers/card/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    );
  }

  if (!site) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-sm text-grade-low">Site not found.</p>
        <Link href="/onsi/site-depth-charts" className="text-sm text-navy hover:underline">
          Back to all sites
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href={`/onsi/site-depth-charts?division=${site.division}`}
        className="text-xs font-medium text-ink-soft hover:text-navy"
      >
        ← All sites
      </Link>

      <div className="mt-2 mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          {site.site_topic}
        </p>
        <h1 className="font-display text-3xl font-bold text-navy">{site.site_name}</h1>
        <p className="text-sm text-ink-soft">Site leader: {site.leader_name}</p>
      </div>

      {traffic?.siteTotals && (
        <div className="card mb-6 rounded-md p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
              Site Snapshot — {traffic.periodLabel}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <div className="font-data text-[10px] uppercase text-ink-soft">Published</div>
              <div className="font-data text-lg font-semibold text-ink">
                {traffic.siteTotals.articlesPublished}
              </div>
            </div>
            <div>
              <div className="font-data text-[10px] uppercase text-ink-soft">Total PVs</div>
              <div className="font-data text-lg font-semibold text-ink">
                {formatCompact(traffic.siteTotals.totalPageviews)}
              </div>
            </div>
            <div>
              <div className="font-data text-[10px] uppercase text-ink-soft">Evergreen PVs</div>
              <div className="font-data text-lg font-semibold text-ink">
                {formatCompact(traffic.siteTotals.evergreenPageviews)}
              </div>
            </div>
            <div>
              <div className="font-data text-[10px] uppercase text-ink-soft">Scroll Depth</div>
              <div className="font-data text-lg font-semibold text-ink">
                {formatPercent(traffic.siteTotals.weightedAvgScrollDepth)}
              </div>
            </div>
            <div>
              <div className="font-data text-[10px] uppercase text-ink-soft">Time on Page</div>
              <div className="font-data text-lg font-semibold text-ink">
                {formatDuration(traffic.siteTotals.weightedAvgTimeOnPage)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-navy">Roster</h2>
        <button
          onClick={() => (requireAuth() ? setAddingNew(true) : null)}
          className="rounded border border-navy px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy hover:text-white"
        >
          + Add Writer
        </button>
      </div>

      {addingNew && (
        <div className="card mb-3 space-y-2 rounded-md p-4">
          <input
            autoFocus
            placeholder="Writer name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded border border-rule-strong px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <input
            placeholder="Traffic dashboard byline (if different)"
            value={newDashboardName}
            onChange={(e) => setNewDashboardName(e.target.value)}
            className="w-full rounded border border-rule-strong px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full rounded border border-rule-strong px-3 py-2 text-sm outline-none focus:border-navy"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAddingNew(false)}
              className="px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={addWriter}
              disabled={busy}
              className="rounded bg-navy px-4 py-1.5 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {writers.length === 0 ? (
        <p className="text-sm italic text-ink-soft">No writers on this roster yet.</p>
      ) : (
        <div className="space-y-2">
          {writers.map((w) => {
            const stats = traffic?.writers[w.id];
            return (
              <div key={w.id} className="card flex flex-wrap items-center justify-between gap-3 rounded-md p-4">
                <div>
                  <div className="font-display text-base font-semibold uppercase text-navy">
                    {w.name}
                  </div>
                  <div className="font-data text-[11px] text-ink-soft">{w.role}</div>
                </div>
                <div className="flex flex-wrap gap-4 font-data text-xs text-ink-soft">
                  <span>
                    <strong className="text-ink">{stats?.articlesPublished ?? 0}</strong> published
                  </span>
                  <span>
                    <strong className="text-ink">{formatCompact(stats?.totalPageviews ?? 0)}</strong> PVs
                  </span>
                  <span>
                    <strong className="text-ink">{formatPercent(stats?.weightedAvgScrollDepth ?? null)}</strong> scroll
                  </span>
                </div>
                <button
                  onClick={() => removeWriter(w.id)}
                  className="text-xs font-medium text-ink-soft hover:text-grease-red"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
