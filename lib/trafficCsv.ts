import Papa from "papaparse";
import type { ParsedTrafficRow } from "./traffic";

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findKey(headerMap: Record<string, string>, ...candidates: string[]): string | null {
  for (const [normalized, original] of Object.entries(headerMap)) {
    for (const c of candidates) {
      if (normalized.includes(c)) return original;
    }
  }
  return null;
}

function parseDateToISO(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  const n = Number(trimmed);
  return isNaN(n) ? null : n;
}

type ParsedRowWithSource = ParsedTrafficRow & { hostname: string | null };

/**
 * Shared row-level parsing: detects columns by flexible header matching
 * (works regardless of column order, and tolerates extra columns like a
 * new "hyperlink" URL field being added to an export without breaking
 * anything that doesn't look for it) and returns one row per CSV line —
 * ungrouped. Both hostname-based (FanSided) and URL-path-based (OnSI)
 * grouping build on top of this.
 */
function parseRows(csvText: string): {
  rows: ParsedRowWithSource[];
  totalRows: number;
  skippedRows: number;
  missingColumns: string[];
} {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const fields = parsed.meta.fields ?? [];
  const headerMap: Record<string, string> = {};
  for (const f of fields) headerMap[normalizeHeader(f)] = f;

  const hostnameKey = findKey(headerMap, "hostname", "domain", "site");
  const titleKey = findKey(headerMap, "articletitle", "title");
  const authorKey = findKey(headerMap, "articleauthor", "author", "writer");
  const urlKey = findKey(headerMap, "articleurl", "pageurl", "permalink", "url", "link", "path");
  const firstPublishedKey = findKey(headerMap, "firstpublished");
  const pageviewsKey = findKey(headerMap, "pageview");
  const scrollDepthKey = findKey(headerMap, "scrolldepth");
  const avgTimeKey = findKey(headerMap, "avgpageduration", "avgtimeonpage", "avgduration", "duration");

  const missingColumns: string[] = [];
  if (!titleKey) missingColumns.push("Article Title");
  if (!pageviewsKey) missingColumns.push("PageViews");

  const rows: ParsedRowWithSource[] = [];
  let skippedRows = 0;

  for (const record of parsed.data) {
    const title = titleKey ? record[titleKey]?.trim() : "";
    if (!title) {
      skippedRows++;
      continue;
    }
    const hostname = hostnameKey ? record[hostnameKey]?.trim() || null : null;
    const author = authorKey ? record[authorKey]?.trim() : null;
    const url = urlKey ? record[urlKey]?.trim() : null;
    rows.push({
      title,
      author: author && author.toLowerCase() !== "null" ? author : null,
      url: url && url.toLowerCase() !== "null" ? url : null,
      firstPublishedDate: firstPublishedKey ? parseDateToISO(record[firstPublishedKey]) : null,
      pageviews: pageviewsKey ? parseNumber(record[pageviewsKey]) ?? 0 : 0,
      scrollDepth: scrollDepthKey ? parseNumber(record[scrollDepthKey]) : null,
      avgTimeOnPage: avgTimeKey ? parseNumber(record[avgTimeKey]) : null,
      hostname,
    });
  }

  return { rows, totalRows: parsed.data.length, skippedRows, missingColumns };
}

export type TrafficCsvGroup = {
  hostname: string | null; // null only when the file has no hostname column at all
  rows: ParsedTrafficRow[];
};

export type TrafficCsvResult = {
  groups: TrafficCsvGroup[];
  totalRows: number;
  skippedRows: number;
  missingColumns: string[];
};

/**
 * Parses a traffic export. If the file contains multiple distinct hostnames
 * (a multi-site export), rows are split into one group per hostname so each
 * can be mapped to its own site and uploaded independently. A single-site
 * file just produces one group, same as before.
 */
export function parseTrafficCsv(csvText: string): TrafficCsvResult {
  const { rows, totalRows, skippedRows, missingColumns } = parseRows(csvText);
  const rowsByHostname = new Map<string | null, ParsedTrafficRow[]>();
  for (const { hostname, ...row } of rows) {
    if (!rowsByHostname.has(hostname)) rowsByHostname.set(hostname, []);
    rowsByHostname.get(hostname)!.push(row);
  }
  const groups: TrafficCsvGroup[] = Array.from(rowsByHostname.entries()).map(
    ([hostname, groupRows]) => ({ hostname, rows: groupRows })
  );
  return { groups, totalRows, skippedRows, missingColumns };
}

// OnSI verticals that contain multiple distinct sub-sites (one per team or
// topic) — grouped two path segments deep, e.g. /nfl/cowboys,
// /college/alabama, /onsi/fantasy. Anything else observed in real OnSI
// traffic (like /collectibles/<article-slug> or /high-school/<state>/...)
// is a single flat site with no sub-grouping, so it's grouped one segment
// deep instead — otherwise every article's unique slug would look like its
// own "site".
const ONSI_HUB_VERTICALS = new Set([
  "nfl", "nba", "mlb", "nhl", "wnba", "college", "onsi", "fannation",
]);

export type OnsiTrafficCsvGroup = {
  urlPath: string; // e.g. "/nfl/cowboys" or "/collectibles"
  rows: ParsedTrafficRow[];
};

export type OnsiTrafficCsvResult = {
  groups: OnsiTrafficCsvGroup[];
  totalRows: number;
  skippedRows: number;
  unclassifiedRows: number; // rows whose URL didn't parse into any path at all
  missingColumns: string[];
};

function extractOnsiUrlPath(rawUrl: string): string | null {
  let path = rawUrl.trim();
  path = path.replace(/^https?:\/\//i, "");
  const firstSlash = path.indexOf("/");
  if (firstSlash === -1) return null; // no path at all, just a bare hostname
  path = path.slice(firstSlash + 1);
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const vertical = segments[0].toLowerCase();
  if (ONSI_HUB_VERTICALS.has(vertical) && segments.length >= 2) {
    return `/${vertical}/${segments[1].toLowerCase()}`;
  }
  return `/${vertical}`;
}

/**
 * Parses an OnSI traffic export. Unlike FanSided, OnSI sites share one
 * hostname (si.com) and can only be told apart by URL path — so rows are
 * grouped by a path prefix derived from each article's URL instead of by
 * hostname. Requires a URL column; rows without one can't be classified.
 */
export function parseOnsiTrafficCsv(csvText: string): OnsiTrafficCsvResult {
  const { rows, totalRows, skippedRows, missingColumns } = parseRows(csvText);
  if (!rows.some((r) => r.url)) missingColumns.push("Article URL");

  const rowsByPath = new Map<string, ParsedTrafficRow[]>();
  let unclassifiedRows = 0;
  for (const { hostname: _hostname, url, ...row } of rows) {
    const path = url ? extractOnsiUrlPath(url) : null;
    if (!path) {
      unclassifiedRows++;
      continue;
    }
    if (!rowsByPath.has(path)) rowsByPath.set(path, []);
    rowsByPath.get(path)!.push({ ...row, url });
  }

  const groups: OnsiTrafficCsvGroup[] = Array.from(rowsByPath.entries()).map(
    ([urlPath, groupRows]) => ({ urlPath, rows: groupRows })
  );

  return { groups, totalRows, skippedRows, unclassifiedRows, missingColumns };
}
