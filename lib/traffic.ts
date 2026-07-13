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
  first_published_date: string | null;
  pageviews: number;
  scroll_depth: number | null;
  avg_time_on_page: number | null;
};

export type ParsedTrafficRow = {
  title: string;
  author: string | null;
  firstPublishedDate: string | null; // ISO yyyy-mm-dd, or null
  pageviews: number;
  scrollDepth: number | null;
  avgTimeOnPage: number | null;
};
