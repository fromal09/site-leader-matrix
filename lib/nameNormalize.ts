export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// A writer can be matched by their display name, their traffic dashboard
// name, and any number of extra aliases (e.g. "John Canady" and "JCanady").
// This collapses all of those into one deduped, normalized set to check
// article bylines against.
export function buildMatchNames(
  name: string,
  trafficDashboardName: string | null | undefined,
  aliases: (string | null | undefined)[] | null | undefined
): string[] {
  const all = [name, trafficDashboardName, ...(aliases ?? [])]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map(normalizeNameKey);
  return Array.from(new Set(all));
}

// Given multiple casing variants of what's really the same name, picks the
// best one to display: prefers a properly-cased version (not ALL CAPS, not
// all lowercase) over the others, falling back to whichever was seen first.
export function pickBestCasing(variants: string[]): string {
  const properCased = variants.find((v) => v !== v.toUpperCase() && v !== v.toLowerCase());
  return properCased ?? variants[0];
}

// Dedupes a list of raw names case-insensitively, returning one entry per
// distinct person with the nicest casing found among their variants.
export function dedupeNamesCaseInsensitive(names: string[]): string[] {
  const groups = new Map<string, string[]>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeNameKey(name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(name);
  }
  return Array.from(groups.values()).map(pickBestCasing);
}
