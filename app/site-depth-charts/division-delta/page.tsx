"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DC_BASE, dcSiteHref, writerTrafficHref } from "@/lib/routes";
import { DIVISIONS } from "@/lib/divisions";
import { formatCompactNumber } from "@/lib/trafficFormat";
import { DeltaValue } from "@/components/DeltaValue";

type SiteDelta = {
  siteId: number;
  siteName: string;
  currentArticlesPublished: number;
  currentTotalPageviews: number;
  articlesPublishedDelta: number;
  totalPageviewsDelta: number;
  hadPrevious: boolean;
};

type WriterDelta = {
  writerId: number;
  name: string;
  siteId: number;
  siteName: string;
  isSiteLeader: boolean;
  currentArticlesPublished: number;
  articlesPublishedDelta: number;
  totalPageviewsDelta: number;
  hadPrevious: boolean;
};

type DeltaResponse = {
  hasData: boolean;
  hasPrevious?: boolean;
  periodLabel?: string;
  siteCount?: number;
  sitesWithPrevious?: number;
  divisionTotals?: {
    currentArticlesPublished: number;
    currentTotalPageviews: number;
    articlesPublishedDelta: number;
    totalPageviewsDelta: number;
  };
  siteDeltas?: SiteDelta[];
  standouts?: WriterDelta[];
  quietLeaders?: WriterDelta[];
};

function DivisionDeltaInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const division = searchParams.get("division") ?? "NFL";

  const [data, setData] = useState<DeltaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/depth-chart-writers/division-delta?division=${encodeURIComponent(division)}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [division]);

  const availableDivisions = DIVISIONS.filter((d) => d.status === "available");

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
            {division} Since Last Upload
          </h1>
          {data?.periodLabel && (
            <p className="mt-1 text-sm text-ink-soft">
              Comparing the current {data.periodLabel} data against whatever was there right
              before the most recent re-upload for each site.
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Articles Published
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {data.divisionTotals!.currentArticlesPublished.toLocaleString()}
                </div>
                <DeltaValue
                  value={data.divisionTotals!.articlesPublishedDelta}
                  format={(v) => v.toLocaleString()}
                />
              </div>
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Total PVs
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {formatCompactNumber(data.divisionTotals!.currentTotalPageviews)}
                </div>
                <DeltaValue
                  value={data.divisionTotals!.totalPageviewsDelta}
                  format={formatCompactNumber}
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="mb-2 font-display text-lg font-semibold text-navy">
              Site-by-Site Movement
            </h2>
            <div className="card overflow-x-auto rounded-md p-4" style={{ backgroundColor: "white" }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                    <th className="py-2 pr-4">Site</th>
                    <th className="py-2 pr-4 text-right">Current PVs</th>
                    <th className="py-2 pr-4 text-right">PV Change</th>
                    <th className="py-2 text-right">Article Change</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.siteDeltas ?? []).map((s) => (
                    <tr key={s.siteId} className="border-t border-rule">
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
                        {formatCompactNumber(s.currentTotalPageviews)}
                      </td>
                      <td className="py-2 pr-4 text-right font-data">
                        {s.hadPrevious ? (
                          <DeltaValue value={s.totalPageviewsDelta} format={formatCompactNumber} />
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-data">
                        {s.hadPrevious ? (
                          <DeltaValue
                            value={s.articlesPublishedDelta}
                            format={(v) => v.toLocaleString()}
                          />
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 font-display text-lg font-semibold text-navy">
                Writers Who Stood Out
              </h2>
              {(data.standouts ?? []).length === 0 ? (
                <p className="text-sm italic text-ink-soft">Nothing to compare yet.</p>
              ) : (
                <ul className="card space-y-1.5 rounded-md p-4">
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
                      <DeltaValue value={w.totalPageviewsDelta} format={formatCompactNumber} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="mb-2 font-display text-lg font-semibold text-navy">
                Site Leaders With No New Articles
              </h2>
              {(data.quietLeaders ?? []).length === 0 ? (
                <p className="text-sm italic text-ink-soft">
                  Every site leader has published something new this period.
                </p>
              ) : (
                <ul className="card space-y-1.5 rounded-md p-4">
                  {(data.quietLeaders ?? []).map((w) => (
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
