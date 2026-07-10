import { CATEGORIES, CategoryKey } from "./categories";
import { average } from "./grades";
import type { Site } from "./types";

export type DivisionStats = {
  categoryAverages: { key: CategoryKey; label: string; avg: number }[];
  weakestCategory: { key: CategoryKey; label: string; avg: number } | null;
  strongestCategory: { key: CategoryKey; label: string; avg: number } | null;
  biggestGaps: { site: Site; gap: number; high: CategoryKey; low: CategoryKey }[];
  needsAttention: { site: Site; avg: number }[];
  topPerformers: { site: Site; avg: number }[];
};

export function computeDivisionStats(sites: Site[]): DivisionStats {
  const categoryAverages = CATEGORIES.map((c) => {
    const vals = sites
      .map((s) => s.scores.find((sc) => sc.category === c.key)?.score)
      .filter((v): v is number => v !== undefined);
    return { key: c.key, label: c.label, avg: average(vals) };
  });

  const weakestCategory =
    categoryAverages.length > 0
      ? categoryAverages.reduce((a, b) => (b.avg < a.avg ? b : a))
      : null;
  const strongestCategory =
    categoryAverages.length > 0
      ? categoryAverages.reduce((a, b) => (b.avg > a.avg ? b : a))
      : null;

  const gapEntries = sites.map((s) => {
    const scored = s.scores.map((sc) => ({ key: sc.category, score: sc.score }));
    if (scored.length === 0) return { site: s, gap: 0, high: "fan_authority" as CategoryKey, low: "fan_authority" as CategoryKey };
    const high = scored.reduce((a, b) => (b.score > a.score ? b : a));
    const low = scored.reduce((a, b) => (b.score < a.score ? b : a));
    return { site: s, gap: high.score - low.score, high: high.key, low: low.key };
  });
  const biggestGaps = [...gapEntries].sort((a, b) => b.gap - a.gap).slice(0, 5);

  const withAvg = sites.map((s) => ({ site: s, avg: average(s.scores.map((sc) => sc.score)) }));
  const needsAttention = [...withAvg].sort((a, b) => a.avg - b.avg).slice(0, 5);
  const topPerformers = [...withAvg].sort((a, b) => b.avg - a.avg).slice(0, 5);

  return {
    categoryAverages,
    weakestCategory,
    strongestCategory,
    biggestGaps,
    needsAttention,
    topPerformers,
  };
}
