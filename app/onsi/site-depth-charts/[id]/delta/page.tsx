"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onsiDcSiteHref as dcSiteHref, onsiWriterTrafficHref as writerTrafficHref } from "@/lib/onsiRoutes";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import { DeltaValue } from "@/components/DeltaValue";
import type { Site } from "@/lib/types";

type WriterDelta = {
  writerId: number;
  name: string;
  currentArticlesPublished: number;
  articlesPublishedDelta: number;
  totalPageviewsDelta: number;
  hadPrevious: boolean;
};

type DeltaResponse = {
  hasData: boolean;
  hasPrevious?: boolean;
  periodLabel?: string;
  previousSnapshotAt?: string;
  currentSite?: {
    articlesPublished: number;
    totalPageviews: number;
    weightedAvgScrollDepth: number | null;
    weightedAvgTimeOnPage: number | null;
  };
  siteDelta?: {
    articlesPublished: number;
    totalPageviews: number;
    weightedAvgScrollDepth: number | null;
    weightedAvgTimeOnPage: number | null;
  };
  writerDeltas?: WriterDelta[];
};

export default function SiteDeltaPage() {
  const params = useParams();
  const id = Number(params.id);

  const [site, setSite] = useState<Site | null>(null);
  const [data, setData] = useState<DeltaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/onsi/sites/${id}`).then((r) => r.json()),
      fetch(`/api/onsi/depth-chart-writers/site/${id}/delta`).then((r) => r.json()),
    ])
      .then(([siteRes, deltaRes]) => {
        setSite(siteRes.site ?? null);
        setData(deltaRes);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href={site ? dcSiteHref(site.id) : "#"}
        className="text-xs font-medium text-ink-soft hover:text-navy"
      >
        ← {site?.site_name ?? "Back to roster"}
      </Link>

      <div className="mt-2 mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          {site?.site_name}
        </p>
        <h1 className="font-display text-3xl font-bold text-navy">Since Last Upload</h1>
        {data?.periodLabel && (
          <p className="mt-1 text-sm text-ink-soft">
            Comparing the current {data.periodLabel} data against what was there right
            before the most recent re-upload.
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : !data?.hasData ? (
        <p className="text-sm italic text-ink-soft">No traffic data uploaded for this site yet.</p>
      ) : !data.hasPrevious ? (
        <p className="text-sm italic text-ink-soft">
          No previous upload to compare against yet — re-upload this site's traffic for the
          same month and this page fills in automatically.
        </p>
      ) : (
        <>
          <div className="card mb-6 rounded-md p-4">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-navy">
              Top-Line Change
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Published
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {data.currentSite!.articlesPublished.toLocaleString()}
                </div>
                <DeltaValue value={data.siteDelta!.articlesPublished} format={(v) => v.toLocaleString()} />
              </div>
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Total PVs
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {formatCompactNumber(data.currentSite!.totalPageviews)}
                </div>
                <DeltaValue value={data.siteDelta!.totalPageviews} format={formatCompactNumber} />
              </div>
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Scroll Depth
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {formatPercent(data.currentSite!.weightedAvgScrollDepth)}
                </div>
                {data.siteDelta!.weightedAvgScrollDepth !== null ? (
                  <DeltaValue
                    value={data.siteDelta!.weightedAvgScrollDepth}
                    format={(v) => `${(v * 100).toFixed(1)}pp`}
                  />
                ) : (
                  <span className="text-ink-soft">—</span>
                )}
              </div>
              <div>
                <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  Time on Page
                </div>
                <div className="font-data text-lg font-semibold text-ink">
                  {formatDuration(data.currentSite!.weightedAvgTimeOnPage)}
                </div>
                {data.siteDelta!.weightedAvgTimeOnPage !== null ? (
                  <DeltaValue
                    value={data.siteDelta!.weightedAvgTimeOnPage}
                    format={(v) => formatDuration(Math.abs(v))}
                  />
                ) : (
                  <span className="text-ink-soft">—</span>
                )}
              </div>
            </div>
          </div>

          <h2 className="mb-2 font-display text-lg font-semibold text-navy">
            Writer-by-Writer
          </h2>
          <div className="card overflow-x-auto rounded-md p-4" style={{ backgroundColor: "white" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-4">Writer</th>
                  <th className="py-2 pr-4 text-right">Published</th>
                  <th className="py-2 pr-4 text-right">Article Change</th>
                  <th className="py-2 text-right">PV Change</th>
                </tr>
              </thead>
              <tbody>
                {(data.writerDeltas ?? []).map((w) => (
                  <tr key={w.writerId} className="border-t border-rule">
                    <td className="py-2 pr-4">
                      <Link
                        href={writerTrafficHref(w.writerId)}
                        className="font-medium uppercase text-navy hover:underline"
                      >
                        {w.name}
                      </Link>
                      {!w.hadPrevious && (
                        <span className="ml-1.5 font-data text-[10px] text-ink-soft">
                          (no previous data)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-data">
                      {w.currentArticlesPublished}
                    </td>
                    <td className="py-2 pr-4 text-right font-data">
                      {w.hadPrevious ? (
                        <DeltaValue value={w.articlesPublishedDelta} format={(v) => v.toLocaleString()} />
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-data">
                      {w.hadPrevious ? (
                        <DeltaValue value={w.totalPageviewsDelta} format={formatCompactNumber} />
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
