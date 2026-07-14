import { formatCompactNumber, formatDuration, formatPercent } from "./trafficFormat";

export type HistoryMetricKey =
  | "articlesPublished"
  | "totalPageviews"
  | "evergreenPageviews"
  | "weightedAvgScrollDepth"
  | "weightedAvgTimeOnPage"
  | "pvPerPublishedArticle";

export const HISTORY_METRICS: { key: HistoryMetricKey; label: string; format: (v: number | null) => string }[] = [
  { key: "totalPageviews", label: "Total PVs", format: (v) => (v === null ? "—" : formatCompactNumber(v)) },
  { key: "articlesPublished", label: "Articles Published", format: (v) => (v === null ? "—" : v.toLocaleString()) },
  { key: "evergreenPageviews", label: "Evergreen PVs", format: (v) => (v === null ? "—" : formatCompactNumber(v)) },
  { key: "weightedAvgScrollDepth", label: "Scroll Depth", format: (v) => formatPercent(v) },
  { key: "weightedAvgTimeOnPage", label: "Time on Page", format: (v) => formatDuration(v) },
  { key: "pvPerPublishedArticle", label: "PVs / New Article", format: (v) => (v === null ? "—" : formatCompactNumber(v)) },
];

export function historyMetricLabel(key: HistoryMetricKey): string {
  return HISTORY_METRICS.find((m) => m.key === key)?.label ?? key;
}
