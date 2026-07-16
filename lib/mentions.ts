// Extracts @Name mentions from note/reply text.
//
// Two passes, since neither alone is enough:
// 1. Match against known names (people who've signed in and done anything
//    tracked anywhere in the app — not just sticky notes). This catches
//    names that don't follow a clean "Capitalized Word" pattern, like
//    "FTE Staff", and disambiguates "Adam" vs "Adam Fromal" correctly by
//    preferring the longest known match.
// 2. Also catch any @Capitalized Name Sequence that ISN'T a known name yet
//    — this is what lets you tag someone who has never signed in before.
//    Their mention just sits there until they eventually do.
export function extractMentions(body: string, knownNames: string[] = []): string[] {
  const found = new Set<string>();
  const lowerBody = body.toLowerCase();
  const matchedRanges: { start: number; end: number }[] = [];

  const sortedKnown = [...new Set(knownNames.filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const name of sortedKnown) {
    const needle = `@${name.toLowerCase()}`;
    let idx = lowerBody.indexOf(needle);
    while (idx !== -1) {
      const alreadyCovered = matchedRanges.some((r) => idx >= r.start && idx < r.end);
      if (!alreadyCovered) {
        found.add(name);
        matchedRanges.push({ start: idx, end: idx + needle.length });
      }
      idx = lowerBody.indexOf(needle, idx + 1);
    }
  }

  const pattern = /@([A-Z][A-Za-z'\u2019-]*(?:\s[A-Z][A-Za-z'\u2019-]*){0,3})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const overlapsKnown = matchedRanges.some((r) => match!.index >= r.start && match!.index < r.end);
    if (!overlapsKnown) {
      found.add(match[1]);
    }
  }

  return Array.from(found);
}

// Client-side helpers for the compose/reply inputs: assumes the cursor is
// at the end of the text (true for how these inputs are used — no mid-text
// editing UI), so we just look at the tail of the string for "@partial".
export function trailingMentionQuery(text: string): string | null {
  const match = text.match(/@([A-Za-z ]{0,30})$/);
  return match ? match[1] : null;
}

export function applyMention(text: string, name: string): string {
  return text.replace(/@([A-Za-z ]{0,30})$/, `@${name} `);
}
