"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCompactNumber, formatPercent, ensureUrlProtocol } from "@/lib/trafficFormat";

export type FluffFinderWriterOption = {
  writerId: number;
  siteId: number;
  label: string; // display name — "Writer Name" (team-wide) or "Writer Name (Site)" (division-wide)
  articlesPublished: number;
};

type FluffArticle = {
  rank: number;
  title: string;
  url: string | null;
  pageviews: number;
  cumulativePageviews: number;
  cumulativePct: number;
};

type FluffResult = {
  writerId: number;
  writerName: string;
  periodKey: string | null;
  totalPageviews: number;
  articles: FluffArticle[];
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as FluffArticle;
  return (
    <div className="rounded border border-rule-strong bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-display font-semibold text-navy">Article #{point.rank}</div>
      <div className="mt-1 max-w-xs font-data text-[11px] text-ink">{point.title}</div>
      <div className="mt-1 font-data">
        Cumulative: <strong>{formatPercent(point.cumulativePct)}</strong> of traffic
      </div>
      <div className="font-data">This article: {formatCompactNumber(point.pageviews)} PVs</div>
    </div>
  );
}

export function FluffFinderPanel({
  writerOptions,
  apiPrefix = "",
}: {
  writerOptions: FluffFinderWriterOption[];
  apiPrefix?: string;
}) {
  const sortedOptions = useMemo(
    () => [...writerOptions].sort((a, b) => b.articlesPublished - a.articlesPublished),
    [writerOptions]
  );
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FluffResult | null>(null);

  useEffect(() => {
    if (sortedOptions.length > 0 && !selectedKey) {
      setSelectedKey(`${sortedOptions[0].siteId}::${sortedOptions[0].writerId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedOptions]);

  useEffect(() => {
    if (!selectedKey) return;
    const [siteId, writerId] = selectedKey.split("::");
    setLoading(true);
    fetch(`/api${apiPrefix}/depth-chart-writers/site/${siteId}/fluff-finder?writerId=${writerId}`)
      .then((r) => r.json())
      .then(setResult)
      .finally(() => setLoading(false));
  }, [selectedKey, apiPrefix]);

  if (sortedOptions.length === 0) {
    return (
      <div className="card rounded-md p-4">
        <p className="text-sm italic text-ink-soft">
          No writers with published articles this period yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card rounded-md p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Fluff Finder</h2>
          <p className="text-xs text-ink-soft">
            Ranks a writer&apos;s current-month articles by pageviews and shows the running
            share of their total traffic — helps spot where new content stops meaningfully
            adding to the total.
          </p>
        </div>
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
        >
          {sortedOptions.map((o) => (
            <option key={`${o.siteId}::${o.writerId}`} value={`${o.siteId}::${o.writerId}`}>
              {o.label} ({o.articlesPublished})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-ink-soft">Loading…</p>
      ) : !result || result.articles.length === 0 ? (
        <p className="py-8 text-center text-sm italic text-ink-soft">
          No published articles this period for this writer.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={result.articles} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
              <XAxis
                dataKey="rank"
                type="number"
                name="Article Number"
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                stroke="var(--rule-strong)"
                label={{ value: "Article Number", position: "insideBottom", offset: -5, fontSize: 11 }}
              />
              <YAxis
                dataKey="cumulativePct"
                domain={[0, 1]}
                tickFormatter={(v) => formatPercent(v)}
                tick={{ fontSize: 11, fill: "var(--ink-soft)" }}
                stroke="var(--rule-strong)"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="cumulativePct"
                stroke="var(--navy)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--navy)" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rule-strong font-data text-[10px] uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Article</th>
                  <th className="py-2 pr-4 text-right">PVs</th>
                  <th className="py-2 text-right">Cumulative % of PVs</th>
                </tr>
              </thead>
              <tbody>
                {result.articles.map((a) => (
                  <tr key={a.rank} className="border-t border-rule">
                    <td className="py-1.5 pr-4 font-data">{a.rank}</td>
                    <td className="max-w-md truncate py-1.5 pr-4">
                      {a.url ? (
                        <a
                          href={ensureUrlProtocol(a.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-navy hover:underline"
                        >
                          {a.title}
                        </a>
                      ) : (
                        a.title
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-data">
                      {formatCompactNumber(a.pageviews)}
                    </td>
                    <td className="py-1.5 text-right font-data">{formatPercent(a.cumulativePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
