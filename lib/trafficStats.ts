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
// Trailing path segments that mark a duplicate/mirror version of the same
// article rather than a different article — stripped before comparing
// URLs so e.g. ".../mason-graham-story" and ".../mason-graham-story/app"
// collapse into one, instead of silently double-counting the article and
// inflating both the published count and total pageviews.
const JUNK_URL_SUFFIXES = ["app", "partner", "amp", "mobile", "m"];

export function normalizeArticleUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.trim();
  if (!u) return null;
  u = u.replace(/^https?:\/\//i, "");
  u = u.split("?")[0].split("#")[0]; // drop query string / fragment
  u = u.replace(/\/+$/, ""); // drop trailing slash(es)
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of JUNK_URL_SUFFIXES) {
      const re = new RegExp(`/${suffix}$`, "i");
      if (re.test(u)) {
        u = u.replace(re, "");
        changed = true;
      }
    }
  }
  return u.toLowerCase() || null;
}

// Collapses rows that share the same article (matched by normalized URL,
// falling back to title when URL is missing) into one, summing pageviews
// and pageview-weighting scroll/time. Protects "articles published" counts
// against overcounting if a CSV ever has more than one row per article for
// the period (e.g. a day-by-day export, or duplicate URL variants like
// /app or /partner) rather than one row per article.
export function articleKey(
  url: string | null | undefined,
  title: string | null | undefined,
  fallbackSeed: number
): string {
  return normalizeArticleUrl(url) || title || `row-${fallbackSeed}`;
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
    // Prefer the shortest URL as the representative for display/linking —
    // duplicate-variant suffixes (/app, /partner, etc.) only ever make a
    // URL longer than its canonical form, never shorter.
    const bestUrlRow = [...group].sort(
      (a, b) => (a.article_url?.length ?? Infinity) - (b.article_url?.length ?? Infinity)
    )[0];
    return {
      ...group[0],
      article_url: bestUrlRow.article_url,
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
