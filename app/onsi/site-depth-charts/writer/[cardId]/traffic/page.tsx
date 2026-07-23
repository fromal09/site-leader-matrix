"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ONSI_DC_BASE as DC_BASE } from "@/lib/onsiRoutes";
import { formatDuration, formatPercent } from "@/lib/trafficFormat";
import type { TrafficArticleRow } from "@/lib/traffic";

type Writer = {
  id: number;
  site_id: number;
  name: string;
  role: string;
  division: string;
  site_name: string;
};

type SortKey = "pageviews" | "date" | "title";

const PAGE_SIZE = 100;

function ArticleTitle({ a }: { a: TrafficArticleRow }) {
  if (a.article_url) {
    return (
      <a
        href={a.article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-navy hover:underline"
      >
        {a.article_title}
      </a>
    );
  }
  return <>{a.article_title}</>;
}

export default function WriterTrafficHistoryPage() {
  const params = useParams();
  const cardId = Number(params.cardId);

  const [writer, setWriter] = useState<Writer | null>(null);
  const [matched, setMatched] = useState(true);
  const [matchNames, setMatchNames] = useState<string[]>([]);
  const [periodBreakdown, setPeriodBreakdown] = useState<{ periodKey: string; count: number }[]>([]);
  const [articles, setArticles] = useState<TrafficArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("pageviews");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/onsi/depth-chart-writers/card/${cardId}/traffic-full`)
      .then((r) => r.json())
      .then((d) => {
        setWriter(d.writer ?? null);
        setMatched(d.matched);
        setMatchNames(d.matchNames ?? []);
        setPeriodBreakdown(d.periodBreakdown ?? []);
        setArticles(d.articles ?? []);
      })
      .finally(() => setLoading(false));
  }, [cardId]);

  const periods = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of articles) map.set(a.period_key, a.period_label);
    return Array.from(map.entries()).sort((x, y) => y[0].localeCompare(x[0]));
  }, [articles]);

  const filtered = useMemo(() => {
    let list = articles;
    if (periodFilter !== "all") list = list.filter((a) => a.period_key === periodFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((a) => a.article_title.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortKey === "pageviews") sorted.sort((a, b) => b.pageviews - a.pageviews);
    else if (sortKey === "date")
      sorted.sort((a, b) =>
        (b.first_published_date ?? "").localeCompare(a.first_published_date ?? "")
      );
    else sorted.sort((a, b) => a.article_title.localeCompare(b.article_title));
    return sorted;
  }, [articles, query, sortKey, periodFilter]);

  const visible = filtered.slice(0, visibleCount);
  const totalPageviews = filtered.reduce((s, a) => s + a.pageviews, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href={writer ? `${DC_BASE}?division=${writer.division}` : DC_BASE}
        className="text-xs font-medium text-ink-soft hover:text-navy"
      >
        ← Site Depth Charts and Performance
      </Link>

      {loading ? (
        <p className="mt-4 text-sm text-ink-soft">Loading…</p>
      ) : !writer ? (
        <p className="mt-4 text-sm text-grade-low">Writer not found.</p>
      ) : (
        <>
          <div className="mt-2 mb-6">
            <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
              Full Article History
            </p>
            <h1 className="font-display text-3xl font-bold uppercase text-navy">{writer.name}</h1>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 font-data text-[11px] uppercase tracking-wide"
              style={{
                backgroundColor: "color-mix(in srgb, var(--navy) 12%, transparent)",
                color: "var(--navy)",
              }}
            >
              {writer.role}
            </span>
          </div>

          {!matched ? (
            <p className="text-sm italic text-ink-soft">
              No traffic data matched
              {matchNames.length > 0 ? ` for "${matchNames.join('", "')}"` : ""} yet.
            </p>
          ) : (
            <>
              <details className="mb-4 rounded border border-rule-strong bg-white p-3 text-xs">
                <summary className="cursor-pointer font-data uppercase tracking-wide text-ink-soft">
                  Matching against {matchNames.length} name{matchNames.length === 1 ? "" : "s"} — click
                  to inspect
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-data text-[10px] uppercase text-ink-soft">
                      Bylines this card matches (on this site only):
                    </span>{" "}
                    {matchNames.map((n) => (
                      <span
                        key={n}
                        className="mr-1.5 inline-block rounded bg-paper px-1.5 py-0.5 font-data text-[11px]"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                  {periodBreakdown.length > 0 && (
                    <div>
                      <span className="font-data text-[10px] uppercase text-ink-soft">
                        Articles per period — an unexpectedly large count in any one period, or a
                        much higher total than this person could plausibly have written, usually
                        means one of the names above is too broad and is matching someone else's
                        bylines too:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {periodBreakdown.map((p) => (
                          <span
                            key={p.periodKey}
                            className="rounded bg-paper px-1.5 py-0.5 font-data text-[11px]"
                          >
                            {p.periodKey}: {p.count.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-data text-xs text-ink-soft">
                  {filtered.length.toLocaleString()} article{filtered.length === 1 ? "" : "s"} ·{" "}
                  {totalPageviews.toLocaleString()} total pageviews
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Search titles…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className="rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                  />
                  <select
                    value={periodFilter}
                    onChange={(e) => {
                      setPeriodFilter(e.target.value);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className="rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                  >
                    <option value="all">All periods</option>
                    {periods.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                  >
                    <option value="pageviews">Sort: Pageviews</option>
                    <option value="date">Sort: Publish date</option>
                    <option value="title">Sort: Title (A–Z)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-rule-strong font-data text-xs uppercase tracking-wide text-ink-soft">
                      <th className="py-2 pr-4">Article</th>
                      <th className="py-2 pr-4">Published</th>
                      <th className="py-2 pr-4">Period</th>
                      <th className="py-2 pr-4 text-right">Pageviews</th>
                      <th className="py-2 pr-4 text-right">Scroll</th>
                      <th className="py-2 pr-4 text-right">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((a, i) => (
                      <tr key={i} className="border-b border-rule">
                        <td className="max-w-md py-2 pr-4">
                          <ArticleTitle a={a} />
                        </td>
                        <td className="py-2 pr-4 text-xs text-ink-soft">
                          {a.first_published_date
                            ? new Date(a.first_published_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-xs text-ink-soft">{a.period_label}</td>
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

              {visibleCount < filtered.length && (
                <button
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="mt-4 text-sm font-medium text-navy hover:underline"
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more (
                  {filtered.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
