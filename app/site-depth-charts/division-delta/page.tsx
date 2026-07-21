"use client";

import { Suspense, Fragment, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DC_BASE, dcSiteHref, writerTrafficHref } from "@/lib/routes";
import { DIVISIONS } from "@/lib/divisions";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import { DeltaValue } from "@/components/DeltaValue";
import { HighlightValue } from "@/components/HighlightValue";

type Metrics = {
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};
type MetricDelta = Metrics; // same shape, values are differences

type WriterRow = {
  writerId: number;
  name: string;
  siteId: number;
  siteName: string;
  isSiteLeader: boolean;
  isSiteEditorOrExpert: boolean;
  current: Metrics;
  today: Metrics;
  delta: MetricDelta | null;
  hadPrevious: boolean;
};

type SiteRow = {
  siteId: number;
  siteName: string;
  importedAt: string | null;
  current: Metrics;
  today: Metrics;
  delta: MetricDelta | null;
  hadPrevious: boolean;
  writers: WriterRow[];
};

type DeltaResponse = {
  hasData: boolean;
  hasPrevious?: boolean;
  periodLabel?: string;
  currentDataAsOf?: string | null;
  previousDataAsOf?: string | null;
  latestPublishDate?: string | null;
  newContentDateRange?: { start: string; end: string } | null;
  siteCount?: number;
  sitesWithPrevious?: number;
  divisionTotals?: {
    current: { articlesPublished: number; totalPageviews: number; pvPerPublishedArticle: number | null };
    delta: { articlesPublished: number; totalPageviews: number };
  };
  siteDeltas?: SiteRow[];
  standouts?: WriterRow[];
  siteLeaderArticles?: WriterRow[];
  quietEditorsAndExperts?: WriterRow[];
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  // Date-only strings (no time component) parse as UTC midnight, which can
  // display as the previous day in timezones behind UTC — force local
  // midnight instead so "2026-07-19" always shows as July 19.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(dateOnly ? `${iso}T00:00:00` : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFocusRange(range: { start: string; end: string } | null | undefined) {
  if (!range) return null;
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  if (range.start === range.end) {
    return start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const endStr = sameMonth
    ? `${end.getDate()}, ${end.getFullYear()}`
    : end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${startStr}-${endStr}`;
}

function rankAmongSites(
  siteId: number,
  metric: (s: SiteRow) => number | null,
  sites: SiteRow[]
): { rank: number; total: number } | null {
  const entries = sites
    .map((s) => ({ id: s.siteId, value: metric(s) }))
    .filter((e): e is { id: number; value: number } => e.value !== null);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.value - a.value);
  const idx = entries.findIndex((e) => e.id === siteId);
  return idx === -1 ? null : { rank: idx + 1, total: entries.length };
}

function DivisionDeltaInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "NFL";

  const [data, setData] = useState<DeltaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<"name" | "pvChange" | "articleChange" | "scrollDepth" | "timeOnPage">(
    "pvChange"
  );
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/depth-chart-writers/division-delta?division=${encodeURIComponent(division)}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [division]);

  function toggleExpanded(siteId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  const availableDivisions = DIVISIONS.filter((d) => d.status === "available");
  const rawSites = data?.siteDeltas ?? [];
  const sites = [...rawSites].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (sortKey) {
      case "name":
        av = a.siteName;
        bv = b.siteName;
        return sortDesc ? (bv as string).localeCompare(av as string) : (av as string).localeCompare(bv as string);
      case "pvChange":
        av = a.delta?.totalPageviews ?? -Infinity;
        bv = b.delta?.totalPageviews ?? -Infinity;
        break;
      case "articleChange":
        av = a.delta?.articlesPublished ?? -Infinity;
        bv = b.delta?.articlesPublished ?? -Infinity;
        break;
      case "scrollDepth":
        av = a.today.weightedAvgScrollDepth ?? -Infinity;
        bv = b.today.weightedAvgScrollDepth ?? -Infinity;
        break;
      case "timeOnPage":
        av = a.today.weightedAvgTimeOnPage ?? -Infinity;
        bv = b.today.weightedAvgTimeOnPage ?? -Infinity;
        break;
    }
    return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  });

  function handleSort(key: typeof sortKey) {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

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
            {division} Daily Changes
          </h1>
          {data?.hasPrevious && (
            <p className="mt-1 text-sm text-ink-soft">
              {data.newContentDateRange
                ? `Focusing on data from ${formatFocusRange(data.newContentDateRange)}.`
                : `Comparing data uploaded ${formatDate(data.currentDataAsOf)} against what was there as of ${formatDate(data.previousDataAsOf)}.`}
            </p>
          )}
        </div>
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
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : !data?.hasData ? (
        <p className="text-sm italic text-ink-soft">No traffic data uploaded for {division} yet.</p>
      ) : !data.hasPrevious ? (
        <p className="text-sm italic text-ink-soft">
          No previous upload to compare against yet — this shows up automatically once a
          site in {division} gets re-uploaded for the same month.
        </p>
      ) : (
        <>
          <div className="card mb-6 rounded-md p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
                Division Totals
              </h2>
              <span className="font-data text-[11px] text-ink-soft">
                {data.sitesWithPrevious} of {data.siteCount} sites have a previous upload to
                compare
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Articles Published
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {data.divisionTotals!.current.articlesPublished.toLocaleString()}
                </div>
                <DeltaValue
                  value={data.divisionTotals!.delta.articlesPublished}
                  format={(v) => v.toLocaleString()}
                />
              </div>
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Total PVs
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {formatCompactNumber(data.divisionTotals!.current.totalPageviews)}
                </div>
                <DeltaValue
                  value={data.divisionTotals!.delta.totalPageviews}
                  format={formatCompactNumber}
                />
              </div>
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  PVs / New Article
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {data.divisionTotals!.current.pvPerPublishedArticle !== null
                    ? formatCompactNumber(data.divisionTotals!.current.pvPerPublishedArticle)
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <h2 className="mb-2 font-display text-lg font-semibold text-navy">
                Writers Who Stood Out
              </h2>
              {(data.standouts ?? []).length === 0 ? (
                <p className="text-sm italic text-ink-soft">Nothing to compare yet.</p>
              ) : (
                <ul className="card max-h-80 space-y-1.5 overflow-y-auto scroll-thin rounded-md p-4">
                  {(data.standouts ?? []).map((w) => (
                    <li key={w.writerId} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <Link
                          href={writerTrafficHref(w.writerId)}
                          className="truncate font-medium uppercase text-navy hover:underline"
                        >
                          {w.name}
                        </Link>
                        <div className="font-data text-[10px] text-ink-soft">{w.siteName}</div>
                      </div>
                      <DeltaValue value={w.delta?.totalPageviews ?? 0} format={formatCompactNumber} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="mb-2 font-display text-lg font-semibold text-navy">
                Site Experts &amp; Editors With No Articles
              </h2>
              {(data.quietEditorsAndExperts ?? []).length === 0 ? (
                <p className="text-sm italic text-ink-soft">
                  Every Site Editor/Expert has published something new this period.
                </p>
              ) : (
                <ul className="card max-h-80 space-y-1.5 overflow-y-auto scroll-thin rounded-md p-4">
                  {(data.quietEditorsAndExperts ?? []).map((w) => (
                    <li key={w.writerId} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={writerTrafficHref(w.writerId)}
                        className="truncate font-medium uppercase text-navy hover:underline"
                      >
                        {w.name}
                      </Link>
                      <span className="font-data text-[10px] text-ink-soft">{w.siteName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="mb-2 font-display text-lg font-semibold text-navy">
                New Articles by Site Leader Since Last Upload
              </h2>
              {(data.siteLeaderArticles ?? []).length === 0 ? (
                <p className="text-sm italic text-ink-soft">No site leaders on record.</p>
              ) : (
                <ul className="card max-h-80 space-y-1.5 overflow-y-auto scroll-thin rounded-md p-4">
                  {(data.siteLeaderArticles ?? []).map((w) => (
                    <li key={w.writerId} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <Link
                          href={writerTrafficHref(w.writerId)}
                          className="truncate font-medium uppercase text-navy hover:underline"
                        >
                          {w.name}
                        </Link>
                        <div className="font-data text-[10px] text-ink-soft">{w.siteName}</div>
                      </div>
                      <span
                        className="font-data text-sm font-semibold"
                        style={{
                          color:
                            (w.delta?.articlesPublished ?? 0) === 0 ? "var(--grease-red)" : "var(--ink)",
                        }}
                      >
                        +{w.delta?.articlesPublished ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <h2 className="mb-2 font-display text-lg font-semibold text-navy">
            Site-by-Site Movement
          </h2>
          <div className="card overflow-x-auto rounded-md p-4" style={{ backgroundColor: "white" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-4"></th>
                  <th
                    className="cursor-pointer select-none py-2 pr-4 hover:text-navy"
                    onClick={() => handleSort("name")}
                  >
                    Site{sortKey === "name" && (sortDesc ? " ▼" : " ▲")}
                  </th>
                  <th
                    className="cursor-pointer select-none py-2 pr-4 text-right hover:text-navy"
                    onClick={() => handleSort("pvChange")}
                  >
                    PV Change{sortKey === "pvChange" && (sortDesc ? " ▼" : " ▲")}
                  </th>
                  <th
                    className="cursor-pointer select-none py-2 pr-4 text-right hover:text-navy"
                    onClick={() => handleSort("articleChange")}
                  >
                    Articles Published{sortKey === "articleChange" && (sortDesc ? " ▼" : " ▲")}
                  </th>
                  <th
                    className="cursor-pointer select-none py-2 pr-4 text-right hover:text-navy"
                    onClick={() => handleSort("scrollDepth")}
                  >
                    Scroll Depth{sortKey === "scrollDepth" && (sortDesc ? " ▼" : " ▲")}
                  </th>
                  <th
                    className="cursor-pointer select-none py-2 text-right hover:text-navy"
                    onClick={() => handleSort("timeOnPage")}
                  >
                    Time on Page{sortKey === "timeOnPage" && (sortDesc ? " ▼" : " ▲")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => {
                  const isOpen = expanded.has(s.siteId);
                  return (
                    <Fragment key={s.siteId}>
                      <tr className="border-t border-rule">
                        <td className="py-2 pr-2">
                          {s.writers.length > 0 && (
                            <button
                              onClick={() => toggleExpanded(s.siteId)}
                              className="text-navy"
                              aria-label={isOpen ? "Collapse" : "Expand"}
                            >
                              {isOpen ? "▾" : "▸"}
                            </button>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <Link href={dcSiteHref(s.siteId)} className="text-navy hover:underline">
                            {s.siteName}
                          </Link>
                          {!s.hadPrevious && (
                            <span className="ml-1.5 font-data text-[10px] text-ink-soft">
                              (no previous upload)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-data">
                          {s.hadPrevious ? (
                            <HighlightValue rank={rankAmongSites(s.siteId, (x) => x.delta?.totalPageviews ?? null, sites)}>
                              <DeltaValue value={s.delta!.totalPageviews} format={formatCompactNumber} />
                            </HighlightValue>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-data">
                          {s.hadPrevious ? (
                            <HighlightValue rank={rankAmongSites(s.siteId, (x) => x.delta?.articlesPublished ?? null, sites)}>
                              <DeltaValue value={s.delta!.articlesPublished} format={(v) => v.toLocaleString()} />
                            </HighlightValue>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-data">
                          <HighlightValue rank={rankAmongSites(s.siteId, (x) => x.today.weightedAvgScrollDepth, sites)}>
                            {formatPercent(s.today.weightedAvgScrollDepth)}
                          </HighlightValue>
                        </td>
                        <td className="py-2 text-right font-data">
                          <HighlightValue rank={rankAmongSites(s.siteId, (x) => x.today.weightedAvgTimeOnPage, sites)}>
                            {formatDuration(s.today.weightedAvgTimeOnPage)}
                          </HighlightValue>
                        </td>
                      </tr>
                      {isOpen && s.writers.length > 0 && (
                        <tr key={`${s.siteId}-writers`} className="border-t border-rule bg-paper">
                          <td colSpan={6} className="p-3">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="font-data text-[9px] uppercase tracking-wide text-ink-soft">
                                  <th className="py-1 pr-4">Writer</th>
                                  <th className="py-1 pr-4 text-right">New Articles</th>
                                  <th className="py-1 pr-4 text-right">PV Change</th>
                                  <th className="py-1 pr-4 text-right">Scroll Depth</th>
                                  <th className="py-1 text-right">Time on Page</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.writers.map((w) => (
                                  <tr key={w.writerId} className="border-t border-rule">
                                    <td className="py-1.5 pr-4">
                                      <Link
                                        href={writerTrafficHref(w.writerId)}
                                        className="font-medium uppercase text-navy hover:underline"
                                      >
                                        {w.name}
                                      </Link>
                                    </td>
                                    <td className="py-1.5 pr-4 text-right font-data">
                                      {w.hadPrevious ? (
                                        <DeltaValue
                                          value={w.delta!.articlesPublished}
                                          format={(v) => v.toLocaleString()}
                                        />
                                      ) : (
                                        <span className="text-ink-soft">—</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right font-data">
                                      {w.hadPrevious ? (
                                        <DeltaValue value={w.delta!.totalPageviews} format={formatCompactNumber} />
                                      ) : (
                                        <span className="text-ink-soft">—</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right font-data">
                                      {formatPercent(w.today.weightedAvgScrollDepth)}
                                    </td>
                                    <td className="py-1.5 text-right font-data">
                                      {formatDuration(w.today.weightedAvgTimeOnPage)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

export default function DivisionDeltaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-sm text-ink-soft">Loading…</p>
        </main>
      }
    >
      <DivisionDeltaInner />
    </Suspense>
  );
}
