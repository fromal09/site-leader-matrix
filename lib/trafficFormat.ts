export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    n
  );
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}

// Scroll depth bands are tuned to typical article-page behavior, not the
// same 0-10 scale used for site-leader grading elsewhere in the app.
export function scrollDepthColor(fraction: number | null): string {
  if (fraction === null) return "var(--ink-soft)";
  if (fraction >= 0.45) return "var(--grade-good)";
  if (fraction >= 0.25) return "var(--grade-mid)";
  return "var(--grade-low)";
}

// Traffic CSV exports store bare URLs (e.g. "www.site.com/article-slug",
// no protocol) — used directly as an <a href>, a browser treats that as a
// relative path off the current page rather than an absolute external
// link, so the click silently goes nowhere useful. This adds https:// only
// when a protocol isn't already present.
export function ensureUrlProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
