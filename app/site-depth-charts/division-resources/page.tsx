"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DC_BASE } from "@/lib/routes";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";

type SiteBreakdown = {
  siteId: number;
  siteName: string;
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

type ResourceWriter = {
  name: string;
  siteCount: number;
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  sites: SiteBreakdown[];
};

type TableSortKey = "name" | "articlesPublished" | "totalPageviews" | "pvPerPublishedArticle" | "weightedAvgScrollDepth" | "weightedAvgTimeOnPage" | "siteCount";

const ROLES = ["Rover", "Staff Writer"] as const;

export default function DivisionResourcesPage() {
  const [role, setRole] = useState<(typeof ROLES)[number]>("Rover");
  const [writers, setWriters] = useState<ResourceWriter[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tableSort, setTableSort] = useState<TableSortKey>("totalPageviews");
  const [tableSortDesc, setTableSortDesc] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/depth-chart-writers/division-resources?role=${encodeURIComponent(role)}`)
      .then((r) => r.json())
      .then((d) => {
        setWriters(d.writers ?? []);
        setPeriodLabel(d.selectedPeriod?.label ?? null);
      })
      .finally(() => setLoading(false));
  }, [role]);

  function toggleExpanded(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSortClick(key: TableSortKey) {
    if (key === tableSort) setTableSortDesc((d) => !d);
    else {
      setTableSort(key);
      setTableSortDesc(true);
    }
  }

  const tableRows = useMemo(() => {
    const copy = [...writers];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (tableSort === "name") {
        av = a.name;
        bv = b.name;
        return tableSortDesc ? bv.toString().localeCompare(av.toString()) : av.toString().localeCompare(bv.toString());
      }
      av = a[tableSort] ?? -Infinity;
      bv = b[tableSort] ?? -Infinity;
      return tableSortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return copy;
  }, [writers, tableSort, tableSortDesc]);

  const columns: { key: TableSortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "siteCount", label: "Sites" },
    { key: "articlesPublished", label: "Published" },
    { key: "totalPageviews", label: "Total PVs" },
    { key: "pvPerPublishedArticle", label: "PVs / New Article" },
    { key: "weightedAvgScrollDepth", label: "Scroll Depth" },
    { key: "weightedAvgTimeOnPage", label: "Time on Page" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href={DC_BASE} className="text-xs font-medium text-ink-soft hover:text-navy">
        ← All sites
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
            Site Depth Charts and Performance
          </p>
          <h1 className="font-display text-3xl font-bold text-navy">Division Resources</h1>
          {periodLabel && (
            <p className="mt-0.5 font-data text-xs text-ink-soft">
              {periodLabel} — stats only include sites where this person holds this exact role
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex overflow-hidden rounded border border-rule-strong">
            <button
              onClick={() => setViewMode("list")}
              className="px-3 py-1.5 text-xs font-medium"
              style={
                viewMode === "list"
                  ? { backgroundColor: "var(--ink-soft)", color: "white" }
                  : { color: "var(--ink-soft)" }
              }
            >
              List
            </button>
            <button
              onClick={() => setViewMode("table")}
              className="px-3 py-1.5 text-xs font-medium"
              style={
                viewMode === "table"
                  ? { backgroundColor: "var(--ink-soft)", color: "white" }
                  : { color: "var(--ink-soft)" }
              }
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : writers.length === 0 ? (
        <p className="text-sm italic text-ink-soft">
          No {role.toLowerCase()}s with matched traffic data yet.
        </p>
      ) : viewMode === "list" ? (
        <ul className="space-y-2">
          {writers.map((w) => {
            const isOpen = expanded.has(w.name);
            return (
              <li key={w.name} className="card rounded-md p-4">
                <button
                  onClick={() => toggleExpanded(w.name)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div>
                    <div className="font-display text-lg font-semibold text-navy">
                      {w.name}
                    </div>
                    <div className="font-data text-[11px] text-ink-soft">
                      {w.siteCount} site{w.siteCount === 1 ? "" : "s"} as {role}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 font-data text-xs text-ink-soft">
                    <span>
                      <strong className="text-ink">{w.articlesPublished}</strong> published
                    </span>
                    <span>
                      <strong className="text-ink">{formatCompactNumber(w.totalPageviews)}</strong>{" "}
                      PVs
                    </span>
                    <span>
                      <strong className="text-ink">{formatPercent(w.weightedAvgScrollDepth)}</strong>{" "}
                      scroll
                    </span>
                    <span className="text-navy">{isOpen ? "▲" : "▾"}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-3 overflow-x-auto border-t border-rule pt-3">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                          <th className="py-1 pr-4">Site</th>
                          <th className="py-1 pr-4 text-right">Published</th>
                          <th className="py-1 pr-4 text-right">Total PVs</th>
                          <th className="py-1 pr-4 text-right">PVs / New Article</th>
                          <th className="py-1 pr-4 text-right">Scroll</th>
                          <th className="py-1 text-right">Avg Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.sites.map((s) => (
                          <tr key={s.siteId} className="border-t border-rule">
                            <td className="py-1.5 pr-4 text-ink">{s.siteName}</td>
                            <td className="py-1.5 pr-4 text-right font-data">
                              {s.articlesPublished}
                            </td>
                            <td className="py-1.5 pr-4 text-right font-data">
                              {formatCompactNumber(s.totalPageviews)}
                            </td>
                            <td className="py-1.5 pr-4 text-right font-data">
                              {s.pvPerPublishedArticle !== null
                                ? formatCompactNumber(s.pvPerPublishedArticle)
                                : "—"}
                            </td>
                            <td className="py-1.5 pr-4 text-right font-data">
                              {formatPercent(s.weightedAvgScrollDepth)}
                            </td>
                            <td className="py-1.5 text-right font-data">
                              {formatDuration(s.weightedAvgTimeOnPage)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`cursor-pointer select-none py-2 pr-4 hover:text-navy ${
                      c.key === "name" ? "" : "text-right"
                    }`}
                    onClick={() => handleSortClick(c.key)}
                  >
                    {c.label}
                    {tableSort === c.key && (tableSortDesc ? " ▼" : " ▲")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((w) => (
                <tr key={w.name} className="border-t border-rule">
                  <td className="py-2 pr-4 font-medium text-ink">{w.name}</td>
                  <td className="py-2 pr-4 text-right font-data">{w.siteCount}</td>
                  <td className="py-2 pr-4 text-right font-data">{w.articlesPublished}</td>
                  <td className="py-2 pr-4 text-right font-data">
                    {formatCompactNumber(w.totalPageviews)}
                  </td>
                  <td className="py-2 pr-4 text-right font-data">
                    {w.pvPerPublishedArticle !== null
                      ? formatCompactNumber(w.pvPerPublishedArticle)
                      : "—"}
                  </td>
                  <td className="py-2 pr-4 text-right font-data">
                    {formatPercent(w.weightedAvgScrollDepth)}
                  </td>
                  <td className="py-2 text-right font-data">
                    {formatDuration(w.weightedAvgTimeOnPage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
