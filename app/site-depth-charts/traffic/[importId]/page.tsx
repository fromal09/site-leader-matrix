"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TRAFFIC_BASE } from "@/lib/routes";
import { formatDuration, formatPercent } from "@/lib/trafficFormat";
import type { ArticleTraffic, TrafficImport } from "@/lib/traffic";

const PAGE_SIZE = 200;

export default function TrafficImportDetailPage() {
  const params = useParams();
  const importId = Number(params.importId);

  const [imp, setImp] = useState<(TrafficImport & { site_name: string; site_topic: string }) | null>(
    null
  );
  const [articles, setArticles] = useState<ArticleTraffic[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/traffic/${importId}`)
      .then((r) => r.json())
      .then((d) => {
        setImp(d.import ?? null);
        setArticles(d.articles ?? []);
      })
      .finally(() => setLoading(false));
  }, [importId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-sm text-ink-soft">Loading…</p>
      </main>
    );
  }

  if (!imp) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-sm text-grade-low">Import not found.</p>
        <Link href={TRAFFIC_BASE} className="text-sm text-navy hover:underline">
          Back to Traffic Data
        </Link>
      </main>
    );
  }

  const visible = articles.slice(0, visibleCount);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href={TRAFFIC_BASE} className="text-xs font-medium text-ink-soft hover:text-navy">
        ← Traffic Data
      </Link>

      <div className="mt-2 mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          {imp.site_topic}
        </p>
        <h1 className="font-display text-3xl font-bold text-navy">{imp.site_name}</h1>
        <p className="text-sm text-ink-soft">
          {imp.period_label} · {imp.row_count.toLocaleString()} articles · uploaded by{" "}
          {imp.imported_by ?? "unknown"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rule-strong font-data text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 pr-4">Article</th>
              <th className="py-2 pr-4">Author</th>
              <th className="py-2 pr-4">First Published</th>
              <th className="py-2 pr-4 text-right">Pageviews</th>
              <th className="py-2 pr-4 text-right">Scroll Depth</th>
              <th className="py-2 pr-4 text-right">Avg Time on Page</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a, i) => (
              <tr key={i} className="border-b border-rule">
                <td className="py-2 pr-4 max-w-md">{a.article_title}</td>
                <td className="py-2 pr-4 text-ink-soft">{a.article_author ?? "—"}</td>
                <td className="py-2 pr-4 text-xs text-ink-soft">
                  {a.first_published_date
                    ? new Date(a.first_published_date).toLocaleDateString()
                    : "—"}
                </td>
                <td className="py-2 pr-4 text-right font-data">
                  {a.pageviews.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right font-data">
                  {formatPercent(a.scroll_depth)}
                </td>
                <td className="py-2 pr-4 text-right font-data">
                  {formatDuration(a.avg_time_on_page)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleCount < articles.length && (
        <button
          onClick={() => setVisibleCount(articles.length)}
          className="mt-4 text-sm font-medium text-navy hover:underline"
        >
          Show all {articles.length.toLocaleString()} rows
        </button>
      )}
    </main>
  );
}
