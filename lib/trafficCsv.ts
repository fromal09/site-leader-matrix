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

  const rowsByHostname = new Map<string | null, ParsedTrafficRow[]>();
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
    const row: ParsedTrafficRow = {
      title,
      author: author && author.toLowerCase() !== "null" ? author : null,
      url: url && url.toLowerCase() !== "null" ? url : null,
      firstPublishedDate: firstPublishedKey ? parseDateToISO(record[firstPublishedKey]) : null,
      pageviews: pageviewsKey ? parseNumber(record[pageviewsKey]) ?? 0 : 0,
      scrollDepth: scrollDepthKey ? parseNumber(record[scrollDepthKey]) : null,
      avgTimeOnPage: avgTimeKey ? parseNumber(record[avgTimeKey]) : null,
    };
    if (!rowsByHostname.has(hostname)) rowsByHostname.set(hostname, []);
    rowsByHostname.get(hostname)!.push(row);
  }

  const groups: TrafficCsvGroup[] = Array.from(rowsByHostname.entries()).map(
    ([hostname, rows]) => ({ hostname, rows })
  );

  return {
    groups,
    totalRows: parsed.data.length,
    skippedRows,
    missingColumns,
  };
}
