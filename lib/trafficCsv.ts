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

export type TrafficCsvResult = {
  hostname: string | null;
  rows: ParsedTrafficRow[];
  totalRows: number;
  skippedRows: number;
  missingColumns: string[];
};

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
  const firstPublishedKey = findKey(headerMap, "firstpublished");
  const pageviewsKey = findKey(headerMap, "pageview");
  const scrollDepthKey = findKey(headerMap, "scrolldepth");
  const avgTimeKey = findKey(headerMap, "avgpageduration", "avgtimeonpage", "avgduration", "duration");

  const missingColumns: string[] = [];
  if (!titleKey) missingColumns.push("Article Title");
  if (!pageviewsKey) missingColumns.push("PageViews");

  const rows: ParsedTrafficRow[] = [];
  let hostname: string | null = null;
  let skippedRows = 0;

  for (const record of parsed.data) {
    const title = titleKey ? record[titleKey]?.trim() : "";
    if (!title) {
      skippedRows++;
      continue;
    }
    if (!hostname && hostnameKey) {
      const h = record[hostnameKey]?.trim();
      if (h) hostname = h;
    }
    const author = authorKey ? record[authorKey]?.trim() : null;
    rows.push({
      title,
      author: author && author.toLowerCase() !== "null" ? author : null,
      firstPublishedDate: firstPublishedKey ? parseDateToISO(record[firstPublishedKey]) : null,
      pageviews: pageviewsKey ? parseNumber(record[pageviewsKey]) ?? 0 : 0,
      scrollDepth: scrollDepthKey ? parseNumber(record[scrollDepthKey]) : null,
      avgTimeOnPage: avgTimeKey ? parseNumber(record[avgTimeKey]) : null,
    });
  }

  return {
    hostname,
    rows,
    totalRows: parsed.data.length,
    skippedRows,
    missingColumns,
  };
}
