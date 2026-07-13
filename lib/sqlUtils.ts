/**
 * Splits a block of SQL into individual statements, safe to run one at a
 * time against the Neon HTTP driver (which doesn't support multi-statement
 * queries). Strips `-- ...` line comments first, so a semicolon appearing
 * inside a comment can't fracture a statement mid-line the way a naive
 * `sql.split(";")` would.
 */
export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");

  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
