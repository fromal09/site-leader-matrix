export type ResourceSiteBreakdown = {
  siteId: number;
  siteName: string;
  division: string;
  role: string;
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
};

export type ResourceWriter = {
  name: string;
  siteCount: number;
  divisions: string[];
  articlesPublished: number;
  totalPageviews: number;
  pvPerPublishedArticle: number | null;
  weightedAvgScrollDepth: number | null;
  weightedAvgTimeOnPage: number | null;
  sites: ResourceSiteBreakdown[];
};

export type ResourceTableSortKey =
  | "name"
  | "articlesPublished"
  | "totalPageviews"
  | "pvPerPublishedArticle"
  | "weightedAvgScrollDepth"
  | "weightedAvgTimeOnPage"
  | "siteCount";
