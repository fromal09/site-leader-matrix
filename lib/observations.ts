export type ObservationTier = "mild" | "moderate" | "strong";
export type ObservationDirection = "above" | "below";

export type Observation = {
  key: "scroll" | "pvPerArticle" | "timeOnPage";
  direction: ObservationDirection;
  tier: ObservationTier;
  deviationPct: number; // signed, e.g. 0.42 for +42%
  label: string; // short badge text
  detail: string; // longer sentence for the traffic panel
};

// Graduated thresholds: below "mild" nothing is flagged at all — the site
// average has to be beaten or missed by at least 15% before it's worth
// calling out. Color intensity then scales with how far past that it goes.
const TIERS: { tier: ObservationTier; min: number }[] = [
  { tier: "strong", min: 0.5 },
  { tier: "moderate", min: 0.3 },
  { tier: "mild", min: 0.15 },
];

function tierFor(absDeviation: number): ObservationTier | null {
  for (const t of TIERS) {
    if (absDeviation >= t.min) return t.tier;
  }
  return null;
}

type WriterMetrics = {
  weightedAvgScrollDepth: number | null;
  pvPerPublishedArticle: number | null;
  weightedAvgTimeOnPage: number | null;
};

type SiteMetrics = {
  weightedAvgScrollDepth: number | null;
  pvPerPublishedArticle: number | null;
  weightedAvgTimeOnPage: number | null;
};

export function computeWriterObservations(
  writer: WriterMetrics,
  site: SiteMetrics
): Observation[] {
  const out: Observation[] = [];

  if (
    writer.weightedAvgScrollDepth !== null &&
    site.weightedAvgScrollDepth !== null &&
    site.weightedAvgScrollDepth > 0
  ) {
    const dev =
      (writer.weightedAvgScrollDepth - site.weightedAvgScrollDepth) /
      site.weightedAvgScrollDepth;
    const tier = tierFor(Math.abs(dev));
    if (tier) {
      const direction: ObservationDirection = dev > 0 ? "above" : "below";
      out.push({
        key: "scroll",
        direction,
        tier,
        deviationPct: dev,
        label: `Scroll ${dev > 0 ? "+" : ""}${Math.round(dev * 100)}%`,
        detail: `Scroll depth is ${Math.round(Math.abs(dev) * 100)}% ${direction} the site average this period.`,
      });
    }
  }

  if (
    writer.pvPerPublishedArticle !== null &&
    site.pvPerPublishedArticle !== null &&
    site.pvPerPublishedArticle > 0
  ) {
    const dev =
      (writer.pvPerPublishedArticle - site.pvPerPublishedArticle) /
      site.pvPerPublishedArticle;
    const tier = tierFor(Math.abs(dev));
    if (tier) {
      const direction: ObservationDirection = dev > 0 ? "above" : "below";
      out.push({
        key: "pvPerArticle",
        direction,
        tier,
        deviationPct: dev,
        label: `PVs/Article ${dev > 0 ? "+" : ""}${Math.round(dev * 100)}%`,
        detail:
          `Average pageviews per new article is ${Math.round(Math.abs(dev) * 100)}% ${direction} the site average this period` +
          (direction === "above" ? " — a strong traffic driver." : "."),
      });
    }
  }

  if (
    writer.weightedAvgTimeOnPage !== null &&
    site.weightedAvgTimeOnPage !== null &&
    site.weightedAvgTimeOnPage > 0
  ) {
    const dev =
      (writer.weightedAvgTimeOnPage - site.weightedAvgTimeOnPage) /
      site.weightedAvgTimeOnPage;
    const tier = tierFor(Math.abs(dev));
    if (tier) {
      const direction: ObservationDirection = dev > 0 ? "above" : "below";
      out.push({
        key: "timeOnPage",
        direction,
        tier,
        deviationPct: dev,
        label: `Time on Page ${dev > 0 ? "+" : ""}${Math.round(dev * 100)}%`,
        detail: `Average time on page is ${Math.round(Math.abs(dev) * 100)}% ${direction} the site average this period.`,
      });
    }
  }

  return out;
}

export function observationBaseColor(direction: ObservationDirection): string {
  return direction === "above" ? "var(--grade-good)" : "var(--grade-low)";
}

// Percentage used for the badge's tinted background — intensity scales with tier.
export function observationBgOpacity(tier: ObservationTier): number {
  if (tier === "strong") return 30;
  if (tier === "moderate") return 18;
  return 9;
}
