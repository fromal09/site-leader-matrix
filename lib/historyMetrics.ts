import { formatCompactNumber, formatDuration, formatPercent } from "./trafficFormat";

export type HistoryMetricKey =
  | "articlesPublished"
  | "totalPageviews"
  | "evergreenPageviews"
  | "weightedAvgScrollDepth"
  | "weightedAvgTimeOnPage"
  | "pvPerPublishedArticle"
  | "impliedContentDepth";

export const HISTORY_METRICS: { key: HistoryMetricKey; label: string; format: (v: number | null) => string }[] = [
  { key: "totalPageviews", label: "Total PVs", format: (v) => (v === null ? "—" : formatCompactNumber(v)) },
  { key: "articlesPublished", label: "Articles Published", format: (v) => (v === null ? "—" : v.toLocaleString()) },
  { key: "evergreenPageviews", label: "Evergreen PVs", format: (v) => (v === null ? "—" : formatCompactNumber(v)) },
  { key: "weightedAvgScrollDepth", label: "Scroll Depth", format: (v) => formatPercent(v) },
  { key: "weightedAvgTimeOnPage", label: "Time on Page", format: (v) => formatDuration(v) },
  { key: "pvPerPublishedArticle", label: "PVs / New Article", format: (v) => (v === null ? "—" : formatCompactNumber(v)) },
  { key: "impliedContentDepth", label: "Implied Content Depth", format: (v) => (v === null ? "—" : formatDuration(v)) },
];

export function historyMetricLabel(key: HistoryMetricKey): string {
  return HISTORY_METRICS.find((m) => m.key === key)?.label ?? key;
}

// Pairs Scroll Depth with Time on Page to estimate what Time on Page would
// be if a reader made it through 100% of the article — a proxy for how
// substantial the content itself is, independent of how far any given
// reader actually got. Trend-view only: this isn't tracked as a real
// metric anywhere else in the app, it's derived purely for chart exploration.
export function computeImpliedContentDepth(
  scrollDepth: number | null,
  timeOnPage: number | null
): number | null {
  if (scrollDepth === null || timeOnPage === null || scrollDepth <= 0) return null;
  return timeOnPage / scrollDepth;
}
