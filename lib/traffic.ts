export type TrafficImport = {
  id: number;
  site_id: number;
  period_key: string;
  period_label: string;
  row_count: number;
  imported_by: string | null;
  imported_at: string;
};

export type ArticleTraffic = {
  id: number;
  import_id: number;
  site_id: number;
  article_title: string;
  article_author: string | null;
  article_url: string | null;
  first_published_date: string | null;
  pageviews: number;
  scroll_depth: number | null;
  avg_time_on_page: number | null;
};

export type ParsedTrafficRow = {
  title: string;
  author: string | null;
  url: string | null;
  firstPublishedDate: string | null; // ISO yyyy-mm-dd, or null
  pageviews: number;
  scrollDepth: number | null;
  avgTimeOnPage: number | null;
};

export type TrafficArticleRow = {
  article_title: string;
  article_url: string | null;
  first_published_date: string | null;
  pageviews: number;
  scroll_depth: number | null;
  avg_time_on_page: number | null;
  period_key: string;
  period_label: string;
  engagementScore?: number;
};

export type LeaderboardWriter = {
  writerId: number;
  name: string;
  role: string;
  siteId: number;
  siteName: string;
  periodLabel: string;
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

export type WriterQuickStats = {
  articlesPublished: number;
  totalPageviews: number;
  publishedPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

export type HomepageTrafficPage = {
  article_title: string;
  pageviews: number;
  scroll_depth: number | null;
  avg_time_on_page: number | null;
};

export type HomepageTraffic = {
  pages: HomepageTrafficPage[];
  totalPageviews: number;
  pageCount: number;
};

export type SiteTrafficTotals = {
  articlesPublished: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  pvPerPublishedArticle: number | null;
};

export type SiteTrafficSummary = {
  periodKey: string | null;
  periodLabel: string | null;
  writers: Record<number, WriterQuickStats>;
  siteTotals: SiteTrafficTotals | null;
};

export type WriterTrafficStats = {
  articlesPublishedCount: number;
  totalPageviews: number;
  evergreenPageviews: number;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

export type WriterTrafficSummary = {
  matched: boolean;
  matchName?: string;
  latestPeriodLabel?: string;
  latestPeriodKey?: string;
  stats?: WriterTrafficStats;
  topPerforming?: TrafficArticleRow[]; // blended traffic + engagement score, latest period
  recentArticles?: TrafficArticleRow[]; // most recently published, latest period
  publishedThisPeriod?: TrafficArticleRow[]; // everything first published in the latest period
  monthly?: { period_key: string; period_label: string; totalPageviews: number; articleCount: number }[];
};
