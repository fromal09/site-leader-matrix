export function pageviewWeightedAverage(
  rows: { value: number | null; pageviews: number }[]
): number | null {
  const valid = rows.filter((r) => r.value !== null);
  const denom = valid.reduce((s, r) => s + r.pageviews, 0);
  if (valid.length === 0 || denom === 0) return null;
  return valid.reduce((s, r) => s + (r.value as number) * r.pageviews, 0) / denom;
}

export function normalizeArticleUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.trim();
  if (!u) return null;
  u = u.replace(/^https?:\/\//i, "");
  u = u.split("?")[0].split("#")[0]; // drop query string / fragment
  u = u.replace(/\/+$/, ""); // drop trailing slash(es)
  if (!u) return null;

  const firstSlash = u.indexOf("/");
  if (firstSlash === -1) return u.toLowerCase(); // bare hostname, nothing to trim

  const hostname = u.slice(0, firstSlash);
  const pathSegments = u
    .slice(firstSlash + 1)
    .split("/")
    .filter(Boolean);
  if (pathSegments.length === 0) return hostname.toLowerCase();

  // Rather than maintaining a growing list of known junk suffixes (/app,
  // /partner(s), /amp, a slideshow page number, a tracking id, or
  // whatever shows up next), find the segment that's actually the real
  // SEO article slug and discard everything after it. A true slug reads
  // like a full sentence ("nolan-teasley-biggest-impact-minnesota-...")
  // and reliably has far more hyphens than a category prefix, page
  // number, or tracking segment — so "most hyphens" is a strong, general
  // signal for "this is the real article identity" regardless of what
  // junk a given CMS happens to tack on after it.
  let bestIndex = -1;
  let bestHyphens = 0;
  pathSegments.forEach((seg, i) => {
    const hyphens = (seg.match(/-/g) ?? []).length;
    if (hyphens > bestHyphens) {
      bestHyphens = hyphens;
      bestIndex = i;
    }
  });

  // No segment had any hyphens at all (e.g. a bare numeric-id URL) — can't
  // confidently identify a slug, so don't guess; keep the full path rather
  // than risk merging two genuinely different articles.
  const kept = bestIndex === -1 ? pathSegments : pathSegments.slice(0, bestIndex + 1);
  return `${hostname}/${kept.join("/")}`.toLowerCase();
}

// Collapses rows that share the same article (matched by normalized URL,
// falling back to title when URL is missing) into one, summing pageviews
// and pageview-weighting scroll/time. Protects "articles published" counts
// against overcounting if a CSV ever has more than one row per article for
// the period (e.g. a day-by-day export, or a duplicate URL variant like a
// slideshow page or a tracking segment tacked on after the real slug)
// rather than one row per article.
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
