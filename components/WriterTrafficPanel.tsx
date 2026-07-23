"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDuration, formatPercent, scrollDepthColor } from "@/lib/trafficFormat";
import { writerTrafficHref } from "@/lib/routes";
import {
  computeWriterObservations,
  observationBaseColor,
} from "@/lib/observations";
import type { TrafficArticleRow, WriterTrafficSummary, SiteTrafficTotals } from "@/lib/traffic";
import { StatTile } from "./StatTile";

function ArticleTitle({ article }: { article: TrafficArticleRow }) {
  if (article.article_url) {
    return (
      <a
        href={article.article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-navy hover:underline"
      >
        {article.article_title}
      </a>
    );
  }
  return <span className="text-ink">{article.article_title}</span>;
}

function SectionHeading({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <p className="font-data text-[11px] uppercase tracking-wide text-ink-soft">{children}</p>
    </div>
  );
}

function RankedArticleRow({
  rank,
  article,
  maxPageviews,
}: {
  rank: number;
  article: TrafficArticleRow;
  maxPageviews: number;
}) {
  const barPct = maxPageviews > 0 ? Math.max(4, (article.pageviews / maxPageviews) * 100) : 0;
  const color = scrollDepthColor(article.scroll_depth);
  return (
    <li className="relative overflow-hidden rounded border border-rule bg-white px-2 py-1.5">
      <div
        className="absolute inset-y-0 left-0 opacity-[0.08]"
        style={{ width: `${barPct}%`, backgroundColor: "var(--navy)" }}
      />
      <div className="relative flex items-start gap-2">
        <span className="font-data text-[11px] font-semibold text-ink-soft">{rank}</span>
        <div className="min-w-0 flex-1">
          <ArticleTitle article={article} />
          <div className="mt-0.5 flex items-center gap-2 font-data text-[11px] text-ink-soft">
            <span>{article.pageviews.toLocaleString()} views</span>
            <span style={{ color }}>{formatPercent(article.scroll_depth)} scroll</span>
            <span>{formatDuration(article.avg_time_on_page)} avg</span>
          </div>
        </div>
      </div>
    </li>
  );
}

export function WriterTrafficPanel({
  writerId,
  siteTotals,
  apiPrefix = "",
}: {
  writerId: number;
  siteTotals: SiteTrafficTotals | null;
  apiPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WriterTrafficSummary | null>(null);
  const [switchingPeriod, setSwitchingPeriod] = useState(false);

  async function toggle() {
    if (!open && !data) {
      setLoading(true);
      const res = await fetch(`${apiPrefix}/api/depth-chart-writers/card/${writerId}/traffic`);
      const d = await res.json();
      setData(d);
      setLoading(false);
    }
    setOpen((o) => !o);
  }

  async function changePeriod(periodKey: string) {
    setSwitchingPeriod(true);
    const res = await fetch(
      `${apiPrefix}/api/depth-chart-writers/card/${writerId}/traffic?period=${encodeURIComponent(periodKey)}`
    );
    const d = await res.json();
    setData(d);
    setSwitchingPeriod(false);
  }

  const s = data?.stats;
  const writerPvPerPublishedArticle =
    s && s.articlesPublishedCount > 0
      ? (s.totalPageviews - s.evergreenPageviews) / s.articlesPublishedCount
      : null;
  const observations =
    s && siteTotals
      ? computeWriterObservations(
          {
            weightedAvgScrollDepth: s.weightedAvgScrollDepth,
            pvPerPublishedArticle: writerPvPerPublishedArticle,
            weightedAvgTimeOnPage: s.weightedAvgTimeOnPage,
          },
          {
            weightedAvgScrollDepth: siteTotals.weightedAvgScrollDepth,
            pvPerPublishedArticle: siteTotals.pvPerPublishedArticle,
            weightedAvgTimeOnPage: siteTotals.weightedAvgTimeOnPage,
          }
        )
      : [];
  const topFive = data?.topPerforming?.slice(0, 5) ?? [];
  const maxTopPageviews = Math.max(1, ...topFive.map((a) => a.pageviews));
  const publishedPreview = data?.publishedThisPeriod?.slice(0, 3) ?? [];

  return (
    <div className="mt-3 border-t border-rule pt-2">
      <button
        type="button"
        onClick={toggle}
        className="font-data text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-navy"
      >
        {open ? "Hide traffic ▲" : "View traffic ▾"}
      </button>
      {open && (
        <div className="mt-3">
          {loading ? (
            <p className="text-xs text-ink-soft">Loading…</p>
          ) : !data?.matched ? (
            <p className="text-xs italic text-ink-soft">
              No traffic data matched{data?.matchName ? ` for "${data.matchName}"` : ""} yet.
              If this doesn&apos;t look right, check the traffic dashboard name on this card.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                {data.monthly && data.monthly.length > 1 ? (
                  <select
                    value={data.latestPeriodKey}
                    onChange={(e) => changePeriod(e.target.value)}
                    disabled={switchingPeriod}
                    className="rounded border border-rule-strong bg-white px-1.5 py-1 font-display text-sm font-semibold text-navy outline-none focus:border-navy"
                  >
                    {[...data.monthly]
                      .sort((a, b) => b.period_key.localeCompare(a.period_key))
                      .map((m) => (
                        <option key={m.period_key} value={m.period_key}>
                          {m.period_label}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="font-display text-sm font-semibold text-navy">
                    {data.latestPeriodLabel}
                  </p>
                )}
                <Link
                  href={writerTrafficHref(writerId)}
                  className="text-[11px] font-medium text-navy hover:underline"
                >
                  Full article history →
                </Link>
              </div>

              {observations.length > 0 && (
                <ul className="space-y-1">
                  {observations.map((o) => (
                    <li
                      key={o.key}
                      className="rounded border px-2 py-1 text-[11px]"
                      style={{
                        borderColor: observationBaseColor(o.direction),
                        color: observationBaseColor(o.direction),
                      }}
                    >
                      {o.direction === "above" ? "▲" : "▼"} {o.detail}
                    </li>
                  ))}
                </ul>
              )}

              {s && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  <StatTile label="Published" value={s.articlesPublishedCount.toLocaleString()} />
                  <StatTile label="Total PVs" value={s.totalPageviews.toLocaleString()} />
                  <StatTile
                    label="Evergreen PVs"
                    value={s.evergreenPageviews.toLocaleString()}
                    sub="older content"
                  />
                  <StatTile
                    label="Scroll Depth"
                    value={formatPercent(s.weightedAvgScrollDepth)}
                    sub="pv-weighted"
                  />
                  <StatTile
                    label="Time on Page"
                    value={formatDuration(s.weightedAvgTimeOnPage)}
                    sub="pv-weighted"
                  />
                </div>
              )}

              {topFive.length > 0 && (
                <div>
                  <SectionHeading color="var(--navy)">
                    Top Performing — blend of traffic &amp; engagement
                  </SectionHeading>
                  <ul className="space-y-1">
                    {topFive.map((a, i) => (
                      <RankedArticleRow
                        key={i}
                        rank={i + 1}
                        article={a}
                        maxPageviews={maxTopPageviews}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {data.recentArticles && data.recentArticles.length > 0 && (
                <div>
                  <SectionHeading color="var(--grade-good)">Recent Articles</SectionHeading>
                  <ul className="space-y-1">
                    {data.recentArticles.map((a, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                        <ArticleTitle article={a} />
                        <span className="shrink-0 font-data text-[11px] text-ink-soft">
                          {a.first_published_date
                            ? new Date(a.first_published_date).toLocaleDateString()
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {publishedPreview.length > 0 && (
                <div>
                  <SectionHeading color="var(--grade-mid)">
                    Published in {data.latestPeriodLabel}
                  </SectionHeading>
                  <ul className="space-y-1">
                    {publishedPreview.map((a, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                        <ArticleTitle article={a} />
                        <span className="shrink-0 font-data text-[11px] text-ink-soft">
                          {a.pageviews.toLocaleString()} views
                        </span>
                      </li>
                    ))}
                  </ul>
                  {(s?.articlesPublishedCount ?? 0) > publishedPreview.length && (
                    <Link
                      href={writerTrafficHref(writerId)}
                      className="mt-1 inline-block text-[11px] font-medium text-navy hover:underline"
                    >
                      + {(s?.articlesPublishedCount ?? 0) - publishedPreview.length} more
                      published this period
                    </Link>
                  )}
                </div>
              )}

              {data.monthly && data.monthly.length > 1 && (
                <div>
                  <SectionHeading color="var(--ink-soft)">Monthly Trend</SectionHeading>
                  <ul className="space-y-1 text-xs">
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
