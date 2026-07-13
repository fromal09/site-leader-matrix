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
