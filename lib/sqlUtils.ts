/**
 * Splits a block of SQL into individual statements, safe to run one at a
 * time against the Neon HTTP driver (which doesn't support multi-statement
 * queries). Strips `-- ...` line comments first, so a semicolon appearing
 * inside a comment can't fracture a statement mid-line the way a naive
 * `sql.split(";")` would. Also tracks PostgreSQL dollar-quoted strings
 * (`$$ ... $$` or `$tag$ ... $tag$`, used for function bodies) so the many
 * semicolons inside a CREATE FUNCTION statement don't get split apart into
 * broken fragments — everything between a pair of matching dollar-quotes
 * is treated as one atomic unit regardless of what punctuation it contains.
 */
export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");

  const statements: string[] = [];
  let current = "";
  let dollarTag: string | null = null; // e.g. "$$" or "$body$" while inside one
  let i = 0;

  while (i < withoutComments.length) {
    const char = withoutComments[i];

    if (dollarTag) {
      current += char;
      if (withoutComments.startsWith(dollarTag, i)) {
        current += dollarTag.slice(1); // already added first char above
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i++;
      continue;
    }

    if (char === "$") {
      const match = withoutComments.slice(i).match(/^\$[a-zA-Z_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += match[0];
        i += match[0].length;
        continue;
      }
    }

    if (char === ";") {
      statements.push(current.trim());
      current = "";
      i++;
      continue;
    }

    current += char;
    i++;
  }
  if (current.trim()) statements.push(current.trim());

  return statements.filter(Boolean);
}
