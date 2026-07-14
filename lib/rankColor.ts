export type RankTier = "strong-good" | "mild-good" | "mild-bad" | "strong-bad" | "neutral";

// Generic: ranks `id` among all entries in `itemsById` by the given metric
// accessor (descending, higher = better). Used for both site-vs-division
// and writer-vs-site-peers comparisons.
export function rankAmong<T>(
  id: number,
  metric: (item: T) => number | null,
  itemsById: Record<number, T>
): { rank: number; total: number } | null {
  const entries = Object.entries(itemsById)
    .map(([k, v]) => ({ id: Number(k), value: metric(v) }))
    .filter((e): e is { id: number; value: number } => e.value !== null);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.value - a.value);
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  return { rank: idx + 1, total: entries.length };
}

// Quartile-based: top quarter of the division = strong green, next quarter =
// mild green, bottom quarter = strong red, third quarter = mild red. Needs
// at least 4 sites with data to be meaningful — below that everything is
// neutral rather than showing misleading color on a tiny sample.
export function rankTier(rank: number, total: number): RankTier {
  if (total < 4) return "neutral";
  const percentile = 1 - (rank - 1) / (total - 1); // 1 = best, 0 = worst
  if (percentile >= 0.75) return "strong-good";
  if (percentile >= 0.5) return "mild-good";
  if (percentile <= 0.25) return "strong-bad";
  return "mild-bad";
}

export function rankTierColors(tier: RankTier): { text: string; bg: string } | null {
  switch (tier) {
    case "strong-good":
      return {
        text: "var(--grade-good)",
        bg: "color-mix(in srgb, var(--grade-good) 22%, transparent)",
      };
    case "mild-good":
      return {
        text: "var(--grade-good)",
        bg: "color-mix(in srgb, var(--grade-good) 10%, transparent)",
      };
    case "mild-bad":
      return {
        text: "var(--grade-low)",
        bg: "color-mix(in srgb, var(--grade-low) 10%, transparent)",
      };
    case "strong-bad":
      return {
        text: "var(--grade-low)",
        bg: "color-mix(in srgb, var(--grade-low) 22%, transparent)",
      };
    default:
      return null;
  }
}
