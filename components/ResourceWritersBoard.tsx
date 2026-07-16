"use client";

import { useMemo, useState } from "react";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import { HighlightValue } from "@/components/HighlightValue";
import type { ResourceWriter, ResourceTableSortKey } from "@/lib/resourceWriters";

export function ResourceWritersBoard({
  writers,
  loading,
  periodLabel,
  emptyText,
  showDivisionColumn = false,
}: {
  writers: ResourceWriter[];
  loading: boolean;
  periodLabel: string | null;
  emptyText: string;
  showDivisionColumn?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tableSort, setTableSort] = useState<ResourceTableSortKey>("totalPageviews");
  const [tableSortDesc, setTableSortDesc] = useState(true);

  function toggleExpanded(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSortClick(key: ResourceTableSortKey) {
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
        return tableSortDesc
          ? bv.toString().localeCompare(av.toString())
          : av.toString().localeCompare(bv.toString());
      }
      av = a[tableSort] ?? -Infinity;
      bv = b[tableSort] ?? -Infinity;
      return tableSortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return copy;
  }, [writers, tableSort, tableSortDesc]);

  function rankOf(
    name: string,
    metric: (w: ResourceWriter) => number | null
  ): { rank: number; total: number } | null {
    const entries = writers
      .map((w) => ({ name: w.name, value: metric(w) }))
      .filter((e): e is { name: string; value: number } => e.value !== null);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b.value - a.value);
    const idx = entries.findIndex((e) => e.name === name);
    return idx === -1 ? null : { rank: idx + 1, total: entries.length };
  }

  const columns: { key: ResourceTableSortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "siteCount", label: "Sites" },
    { key: "articlesPublished", label: "Published" },
    { key: "totalPageviews", label: "Total PVs" },
    { key: "pvPerPublishedArticle", label: "PVs / New Article" },
    { key: "weightedAvgScrollDepth", label: "Scroll Depth" },
    { key: "weightedAvgTimeOnPage", label: "Time on Page" },
  ];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        {periodLabel ? (
          <p className="font-data text-xs text-ink-soft">
            {periodLabel} — stats only include sites where this person holds a matching role
          </p>
        ) : (
          <span />
        )}
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

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : writers.length === 0 ? (
        <p className="text-sm italic text-ink-soft">{emptyText}</p>
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
                    <div className="font-display text-lg font-semibold uppercase text-navy">
                      {w.name}
                    </div>
                    <div className="font-data text-[11px] text-ink-soft">
                      {w.siteCount} site{w.siteCount === 1 ? "" : "s"}
                      {showDivisionColumn && w.divisions.length > 0
                        ? ` · ${w.divisions.join(", ")}`
                        : ""}
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
                          {showDivisionColumn && <th className="py-1 pr-4">Division</th>}
                          <th className="py-1 pr-4">Role</th>
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
                            {showDivisionColumn && (
                              <td className="py-1.5 pr-4 font-data text-xs text-ink-soft">
                                {s.division}
                              </td>
                            )}
                            <td className="py-1.5 pr-4 font-data text-xs text-ink-soft">
                              {s.role}
                            </td>
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
        <div className="card overflow-x-auto rounded-md p-4" style={{ backgroundColor: "white" }}>
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
                {showDivisionColumn && (
                  <th className="py-2 pr-4">Divisions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((w) => (
                <tr key={w.name} className="border-t border-rule">
                  <td className="py-2 pr-4 font-medium uppercase text-ink">{w.name}</td>
                  <td className="py-2 pr-4 text-right font-data">{w.siteCount}</td>
                  <td className="py-2 pr-4 text-right font-data">
                    <HighlightValue rank={rankOf(w.name, (x) => x.articlesPublished)}>
                      {w.articlesPublished}
                    </HighlightValue>
                  </td>
                  <td className="py-2 pr-4 text-right font-data">
                    <HighlightValue rank={rankOf(w.name, (x) => x.totalPageviews)}>
                      {formatCompactNumber(w.totalPageviews)}
                    </HighlightValue>
                  </td>
                  <td className="py-2 pr-4 text-right font-data">
                    <HighlightValue rank={rankOf(w.name, (x) => x.pvPerPublishedArticle)}>
                      {w.pvPerPublishedArticle !== null
                        ? formatCompactNumber(w.pvPerPublishedArticle)
                        : "—"}
                    </HighlightValue>
                  </td>
                  <td className="py-2 pr-4 text-right font-data">
                    <HighlightValue rank={rankOf(w.name, (x) => x.weightedAvgScrollDepth)}>
                      {formatPercent(w.weightedAvgScrollDepth)}
                    </HighlightValue>
                  </td>
                  <td className="py-2 text-right font-data">
                    <HighlightValue rank={rankOf(w.name, (x) => x.weightedAvgTimeOnPage)}>
                      {formatDuration(w.weightedAvgTimeOnPage)}
                    </HighlightValue>
                  </td>
                  {showDivisionColumn && (
                    <td className="py-2 pr-4 font-data text-xs text-ink-soft">
                      {w.divisions.join(", ")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
