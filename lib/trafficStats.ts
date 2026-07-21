export function pageviewWeightedAverage(
  rows: { value: number | null; pageviews: number }[]
): number | null {
  const valid = rows.filter((r) => r.value !== null);
  const denom = valid.reduce((s, r) => s + r.pageviews, 0);
  if (valid.length === 0 || denom === 0) return null;
  return valid.reduce((s, r) => s + (r.value as number) * r.pageviews, 0) / denom;
}

// Collapses rows that share the same article (matched by URL, falling back
// to title when URL is missing) into one, summing pageviews and
// pageview-weighting scroll/time. Protects "articles published" counts
// against overcounting if a CSV ever has more than one row per article for
// the period (e.g. a day-by-day export) rather than one row per article.
export function articleKey(
  url: string | null | undefined,
  title: string | null | undefined,
  fallbackSeed: number
): string {
  return (url && url.trim()) || title || `row-${fallbackSeed}`;
}

export function dedupeArticles<
  T extends { article_url?: string | null; article_title?: string | null; pageviews: number; scroll_depth: number | null; avg_time_on_page: number | null }
>(rows: T[]): T[] {
  const byArticle = new Map<string, T[]>();
  for (const r of rows) {
    const key = articleKey(r.article_url, r.article_title, byArticle.size);
    if (!byArticle.has(key)) byArticle.set(key, []);
    byArticle.get(key)!.push(r);
  }
  return Array.from(byArticle.values()).map((group) => {
    if (group.length === 1) return group[0];
    const pageviews = group.reduce((s, r) => s + r.pageviews, 0);
    return {
      ...group[0],
      pageviews,
      scroll_depth: pageviewWeightedAverage(
        group.map((r) => ({ value: r.scroll_depth, pageviews: r.pageviews }))
      ),
      avg_time_on_page: pageviewWeightedAverage(
        group.map((r) => ({ value: r.avg_time_on_page, pageviews: r.pageviews }))
      ),
    };
  });
}
