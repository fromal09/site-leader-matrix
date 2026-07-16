// Extracts @Name mentions from note/reply text. Since anyone can sign in
// with any typed name (no fixed user accounts), matching is done against
// the pool of names that have actually shown up as an author before —
// checked longest-name-first so "@Adam Fromal" matches the full name
// rather than stopping at "@Adam".
export function extractMentions(body: string, knownNames: string[]): string[] {
  const found = new Set<string>();
  const lowerBody = body.toLowerCase();
  const sorted = [...new Set(knownNames.filter(Boolean))].sort((a, b) => b.length - a.length);

  for (const name of sorted) {
    const needle = `@${name.toLowerCase()}`;
    if (lowerBody.includes(needle)) {
      found.add(name);
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
