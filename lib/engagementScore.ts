/**
 * Blended score for ranking "top performing" articles by traffic AND
 * engagement, rather than pageviews alone.
 *
 * Base: log10(pageviews) — compresses the huge range between a 1-view and
 * 180,000-view article so a handful of outliers don't dominate every list.
 *
 * Multiplier: 0.60 fixed + up to 0.25 for scroll depth + up to 0.15 for
 * average time on page (capped at 3 minutes, since beyond that more time
 * usually means "left the tab open," not more engagement). So two articles
 * with identical traffic can differ by up to ~40% in score based on how
 * engaged readers actually were.
 *
 * This is intentionally simple and inspectable rather than a statistical
 * model — the goal is "traffic-led, engagement-adjusted," not a precise
 * predictive score.
 */
export function computeEngagementScore(
  pageviews: number,
  scrollDepth: number | null,
  avgTimeOnPage: number | null
): number {
  const pvBase = Math.log10(Math.max(pageviews, 0) + 1);
  const scrollFactor = scrollDepth !== null ? Math.max(0, Math.min(scrollDepth, 1)) : 0;
  const timeFactor = avgTimeOnPage !== null ? Math.max(0, Math.min(avgTimeOnPage / 180, 1)) : 0;
  const multiplier = 0.6 + 0.25 * scrollFactor + 0.15 * timeFactor;
  return pvBase * multiplier;
}
