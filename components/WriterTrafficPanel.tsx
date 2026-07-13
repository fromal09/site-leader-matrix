"use client";

import { useState } from "react";
import { formatDuration, formatPercent } from "@/lib/trafficFormat";
import type { TrafficArticleRow, WriterTrafficSummary } from "@/lib/traffic";

function ArticleTitle({ article }: { article: TrafficArticleRow }) {
  if (article.article_url) {
    return (
      <a
        href={article.article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate text-navy hover:underline"
      >
        {article.article_title}
      </a>
    );
  }
  return <span className="truncate">{article.article_title}</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-rule-strong bg-white px-2 py-1.5">
      <div className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      <div className="font-data text-sm font-semibold text-ink">{value}</div>
      {sub && <div className="text-[10px] text-ink-soft">{sub}</div>}
    </div>
  );
}

export function WriterTrafficPanel({ writerId }: { writerId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WriterTrafficSummary | null>(null);
  const [showAllPublished, setShowAllPublished] = useState(false);

  async function toggle() {
    if (!open && !data) {
      setLoading(true);
      const res = await fetch(`/api/depth-chart-writers/card/${writerId}/traffic`);
      const d = await res.json();
      setData(d);
      setLoading(false);
    }
    setOpen((o) => !o);
  }

  const s = data?.stats;
  const publishedVisible = showAllPublished
    ? data?.publishedThisPeriod ?? []
    : (data?.publishedThisPeriod ?? []).slice(0, 8);

  return (
    <div className="mt-3 border-t border-rule pt-2">
      <button
        type="button"
        onClick={toggle}
        className="text-xs font-medium text-ink-soft hover:text-navy"
      >
        {open ? "Hide traffic ▲" : "View traffic ▾"}
      </button>
      {open && (
        <div className="mt-2 text-xs">
          {loading ? (
            <p className="text-ink-soft">Loading…</p>
          ) : !data?.matched ? (
            <p className="italic text-ink-soft">
              No traffic data matched{data?.matchName ? ` for "${data.matchName}"` : ""} yet.
              If this doesn&apos;t look right, check the traffic dashboard name on this card.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="font-data text-ink-soft">{data.latestPeriodLabel}</p>

              {s && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  <StatCard
                    label="Published"
                    value={s.articlesPublishedCount.toLocaleString()}
                  />
                  <StatCard label="Total PVs" value={s.totalPageviews.toLocaleString()} />
                  <StatCard
                    label="Evergreen PVs"
                    value={s.evergreenPageviews.toLocaleString()}
                    sub="from older content"
                  />
                  <StatCard
                    label="Avg Scroll Depth"
                    value={formatPercent(s.weightedAvgScrollDepth)}
                    sub="pageview-weighted"
                  />
                  <StatCard
                    label="Avg Time on Page"
                    value={formatDuration(s.weightedAvgTimeOnPage)}
                    sub="pageview-weighted"
                  />
                </div>
              )}

              {data.topPerforming && data.topPerforming.length > 0 && (
                <div>
                  <p className="font-data uppercase tracking-wide text-ink-soft">
                    Top Performing{" "}
                    <span className="normal-case text-ink-soft">
                      (blend of traffic &amp; engagement)
                    </span>
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {data.topPerforming.map((a, i) => (
                      <li key={i}>
                        <ArticleTitle article={a} />
                        <div className="font-data text-[11px] text-ink-soft">
                          {a.pageviews.toLocaleString()} views · {formatPercent(a.scroll_depth)}{" "}
                          scroll · {formatDuration(a.avg_time_on_page)} avg
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.recentArticles && data.recentArticles.length > 0 && (
                <div>
                  <p className="font-data uppercase tracking-wide text-ink-soft">
                    Recent Articles
                  </p>
                  <ul className="mt-1 space-y-1">
                    {data.recentArticles.map((a, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <ArticleTitle article={a} />
                        <span className="shrink-0 text-ink-soft">
                          {a.first_published_date
                            ? new Date(a.first_published_date).toLocaleDateString()
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.publishedThisPeriod && data.publishedThisPeriod.length > 0 && (
                <div>
                  <p className="font-data uppercase tracking-wide text-ink-soft">
                    All Content Published in {data.latestPeriodLabel}
                  </p>
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-ink-soft">
                          <th className="pb-1 pr-2 font-data">Article</th>
                          <th className="pb-1 pr-2 text-right font-data">PVs</th>
                          <th className="pb-1 pr-2 text-right font-data">Scroll</th>
                          <th className="pb-1 text-right font-data">Avg Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publishedVisible.map((a, i) => (
                          <tr key={i} className="border-t border-rule">
                            <td className="max-w-[220px] py-1 pr-2">
                              <ArticleTitle article={a} />
                            </td>
                            <td className="py-1 pr-2 text-right font-data">
                              {a.pageviews.toLocaleString()}
                            </td>
                            <td className="py-1 pr-2 text-right font-data">
                              {formatPercent(a.scroll_depth)}
                            </td>
                            <td className="py-1 text-right font-data">
                              {formatDuration(a.avg_time_on_page)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!showAllPublished && (data.publishedThisPeriod?.length ?? 0) > 8 && (
                    <button
                      onClick={() => setShowAllPublished(true)}
                      className="mt-1 text-[11px] font-medium text-navy hover:underline"
                    >
                      Show all {data.publishedThisPeriod.length}
                    </button>
                  )}
                </div>
              )}

              {data.monthly && data.monthly.length > 1 && (
                <div>
                  <p className="font-data uppercase tracking-wide text-ink-soft">
                    Monthly Trend
                  </p>
                  <ul className="mt-1 space-y-1">
                    {data.monthly.map((m) => (
                      <li key={m.period_key} className="flex justify-between">
                        <span>{m.period_label}</span>
                        <span className="font-data text-ink-soft">
                          {m.totalPageviews.toLocaleString()} views
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
