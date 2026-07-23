"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import type { DepthChartRole } from "@/lib/depthCharts";

type CandidateAuthor = { name: string; articles: number; pageviews: number };
type SiteGroup = { siteId: number; siteName: string; division: string; authors: CandidateAuthor[] };

type RowStatus = "pending" | "added" | "declined";
type RowState = { role: string; status: RowStatus; busy: boolean; error: string | null };

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function NetworkNewAuthorsReview({
  roles,
  apiPrefix = "",
  dcSiteHref,
}: {
  roles: DepthChartRole[];
  apiPrefix?: string;
  dcSiteHref: (id: number | string) => string;
}) {
  const { requireAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [sites, setSites] = useState<SiteGroup[]>([]);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  function rowKey(siteId: number, name: string) {
    return `${siteId}::${name}`;
  }

  async function runCheck() {
    if (!requireAuth()) return;
    setLoading(true);
    const res = await fetch(`${apiPrefix}/api/depth-chart-writers/uncredited-authors`);
    const d = await res.json();
    const fetchedSites: SiteGroup[] = d.sites ?? [];
    setSites(fetchedSites);
    const initial: Record<string, RowState> = {};
    for (const s of fetchedSites) {
      for (const a of s.authors) {
        initial[rowKey(s.siteId, a.name)] = {
          role: roles[0]?.label ?? "",
          status: "pending",
          busy: false,
          error: null,
        };
      }
    }
    setRowStates(initial);
    setChecked(true);
    setLoading(false);
  }

  function updateRole(key: string, role: string) {
    setRowStates((prev) => ({ ...prev, [key]: { ...prev[key], role } }));
  }

  async function addAuthor(siteId: number, name: string) {
    if (!requireAuth()) return;
    const key = rowKey(siteId, name);
    const row = rowStates[key];
    if (!row || !row.role) return;
    setRowStates((prev) => ({ ...prev, [key]: { ...prev[key], busy: true, error: null } }));
    const res = await fetch(`${apiPrefix}/api/depth-chart-writers/${siteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role: row.role, trafficDashboardName: name }),
    });
    if (res.ok) {
      setRowStates((prev) => ({ ...prev, [key]: { ...prev[key], busy: false, status: "added" } }));
    } else {
      const d = await res.json().catch(() => ({}));
      setRowStates((prev) => ({
        ...prev,
        [key]: { ...prev[key], busy: false, error: d.error ?? "Couldn't add." },
      }));
    }
  }

  async function declineAuthor(siteId: number, name: string) {
    if (!requireAuth()) return;
    const key = rowKey(siteId, name);
    setRowStates((prev) => ({ ...prev, [key]: { ...prev[key], busy: true } }));
    await fetch(`${apiPrefix}/api/depth-chart-writers/site/${siteId}/ignored-authors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: name }),
    });
    setRowStates((prev) => ({ ...prev, [key]: { ...prev[key], busy: false, status: "declined" } }));
  }

  const totalPending = Object.values(rowStates).filter((r) => r.status === "pending").length;

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">
            New Authors — Whole Network
          </h2>
          <p className="text-xs text-ink-soft">
            Checks every site&apos;s most recent upload for bylines that don&apos;t have a
            roster card yet — one pass instead of visiting each site individually.
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="rounded border border-navy px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-60"
        >
          {loading ? "Checking…" : checked ? "Re-check Network" : "Check Whole Network"}
        </button>
      </div>

      {checked && !loading && (
        <>
          {totalPending === 0 ? (
            <p className="mt-2 text-sm italic text-ink-soft">
              Checked {sites.length === 0 ? "the network" : `${sites.length} site${sites.length === 1 ? "" : "s"}`}{" "}
              — every byline with recent traffic already has a roster card.
            </p>
          ) : (
            <p className="mt-2 font-data text-xs text-ink-soft">
              {totalPending} uncredited author{totalPending === 1 ? "" : "s"} across{" "}
              {sites.length} site{sites.length === 1 ? "" : "s"}
            </p>
          )}

          <div className="mt-3 space-y-4">
            {sites.map((s) => {
              const siteRows = s.authors.filter((a) => rowStates[rowKey(s.siteId, a.name)]);
              if (siteRows.length === 0) return null;
              const stillPending = siteRows.filter(
                (a) => rowStates[rowKey(s.siteId, a.name)]?.status === "pending"
              );
              if (stillPending.length === 0) return null;
              return (
                <div key={s.siteId} className="rounded border border-rule-strong bg-white p-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <Link
                      href={dcSiteHref(s.siteId)}
                      className="font-display text-sm font-semibold text-navy hover:underline"
                    >
                      {s.siteName}
                    </Link>
                    <span className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                      {s.division}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {stillPending.map((a) => {
                      const key = rowKey(s.siteId, a.name);
                      const row = rowStates[key];
                      return (
                        <li
                          key={key}
                          className="flex flex-col gap-2 rounded border border-rule bg-paper px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="text-sm">
                            <span className="font-medium text-ink">{a.name}</span>{" "}
                            <span className="font-data text-[10px] text-ink-soft">
                              {a.articles} article{a.articles === 1 ? "" : "s"} ·{" "}
                              {formatCompact(a.pageviews)} PVs
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={row.role}
                              onChange={(e) => updateRole(key, e.target.value)}
                              disabled={row.busy}
                              className="rounded border border-rule-strong bg-white px-2 py-1 text-xs outline-none focus:border-navy"
                            >
                              {roles.map((r) => (
                                <option key={r.id} value={r.label}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => addAuthor(s.siteId, a.name)}
                              disabled={row.busy}
                              className="rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => declineAuthor(s.siteId, a.name)}
                              disabled={row.busy}
                              className="text-xs font-medium text-ink-soft hover:text-grease-red disabled:opacity-60"
                            >
                              Decline
                            </button>
                          </div>
                          {row.error && <p className="text-xs text-grade-low">{row.error}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
