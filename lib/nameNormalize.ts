export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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
