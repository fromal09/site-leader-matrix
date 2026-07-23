"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import type { DepthChartRole } from "@/lib/depthCharts";

type PendingAuthor = {
  name: string; // display casing as it appeared in the CSV
  status: "pending" | "added" | "declined";
  role: string;
  busy: boolean;
  error: string | null;
};

export function NewAuthorsReview({
  siteId,
  siteName,
  csvAuthors,
  roles,
  apiPrefix = "",
  onResult,
}: {
  siteId: number;
  siteName: string;
  csvAuthors: string[];
  roles: DepthChartRole[];
  apiPrefix?: string;
  onResult?: (foundCount: number) => void;
}) {
  const { requireAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAuthor[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [writersRes, ignoredRes] = await Promise.all([
        fetch(`/api${apiPrefix}/depth-chart-writers/${siteId}`).then((r) => r.json()),
        fetch(`/api${apiPrefix}/depth-chart-writers/site/${siteId}/ignored-authors`).then((r) => r.json()),
      ]);
      const existingNames = new Set(
        (writersRes.writers ?? []).flatMap((w: any) =>
          [w.name, w.traffic_dashboard_name, ...(w.aliases ?? [])]
            .filter(Boolean)
            .map((n: string) => n.trim().toLowerCase())
        )
      );
      const ignoredNames = new Set(
        (ignoredRes.authors ?? []).map((n: string) => n.trim().toLowerCase())
      );

      const seen = new Set<string>();
      const newOnes: PendingAuthor[] = [];
      for (const raw of csvAuthors) {
        const name = raw.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key) || existingNames.has(key) || ignoredNames.has(key)) continue;
        seen.add(key);
        newOnes.push({
          name,
          status: "pending",
          role: roles[0]?.label ?? "",
          busy: false,
          error: null,
        });
      }
      newOnes.sort((a, b) => a.name.localeCompare(b.name));
      setPending(newOnes);
      setLoading(false);
      onResult?.(newOnes.length);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  function updateRole(name: string, role: string) {
    setPending((prev) => prev.map((p) => (p.name === name ? { ...p, role } : p)));
  }

  async function addAuthor(name: string) {
    if (!requireAuth()) return;
    const author = pending.find((p) => p.name === name);
    if (!author || !author.role) return;
    setPending((prev) => prev.map((p) => (p.name === name ? { ...p, busy: true, error: null } : p)));
    const res = await fetch(`/api${apiPrefix}/depth-chart-writers/${siteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role: author.role, trafficDashboardName: name }),
    });
    if (res.ok) {
      setPending((prev) => prev.map((p) => (p.name === name ? { ...p, busy: false, status: "added" } : p)));
    } else {
      const d = await res.json().catch(() => ({}));
      setPending((prev) =>
        prev.map((p) =>
          p.name === name ? { ...p, busy: false, error: d.error ?? "Couldn't add." } : p
        )
      );
    }
  }

  async function declineAuthor(name: string) {
    if (!requireAuth()) return;
    setPending((prev) => prev.map((p) => (p.name === name ? { ...p, busy: true } : p)));
    await fetch(`/api${apiPrefix}/depth-chart-writers/site/${siteId}/ignored-authors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: name }),
    });
    setPending((prev) => prev.map((p) => (p.name === name ? { ...p, busy: false, status: "declined" } : p)));
  }

  if (loading) return null;

  const stillPending = pending.filter((p) => p.status === "pending");
  const resolved = pending.filter((p) => p.status !== "pending");

  if (pending.length === 0) return null;

  return (
    <div className="card rounded-md p-4">
      <h3 className="font-display text-sm font-semibold text-navy">
        New Authors in {siteName}
      </h3>
      <p className="mt-0.5 text-xs text-ink-soft">
        These bylines published a new article this month but don&apos;t have a roster card
        yet. Add them with a role, or decline to stop seeing them here.
      </p>

      {stillPending.length > 0 && (
        <ul className="mt-3 space-y-2">
          {stillPending.map((p) => (
            <li
              key={p.name}
              className="flex flex-col gap-2 rounded border border-rule-strong bg-white p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium text-ink">{p.name}</span>
              <div className="flex items-center gap-2">
                <select
                  value={p.role}
                  onChange={(e) => updateRole(p.name, e.target.value)}
                  disabled={p.busy}
                  className="rounded border border-rule-strong bg-white px-2 py-1 text-xs outline-none focus:border-navy"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.label}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => addAuthor(p.name)}
                  disabled={p.busy}
                  className="rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
                >
                  Add
                </button>
                <button
                  onClick={() => declineAuthor(p.name)}
                  disabled={p.busy}
                  className="text-xs font-medium text-ink-soft hover:text-grease-red disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
              {p.error && <p className="text-xs text-grade-low">{p.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <ul className="mt-2 space-y-1">
          {resolved.map((p) => (
            <li key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
              <span>{p.name}</span>
              <span className={p.status === "added" ? "text-grade-good" : "text-ink-soft"}>
                {p.status === "added" ? `added as ${p.role}` : "declined"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
