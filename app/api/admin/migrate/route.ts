import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SCHEMA_SQL } from "@/lib/schema";
import { splitSqlStatements } from "@/lib/sqlUtils";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const statements = splitSqlStatements(SCHEMA_SQL);

  let ran = 0;
  try {
    for (const stmt of statements) {
      await sql.query(stmt);
      ran++;
    }
    return NextResponse.json({ ok: true, ranStatements: ran, totalStatements: statements.length });
  } catch (err: any) {
    const failedStatement = statements[ran]?.slice(0, 200) ?? "(unknown)";
    return NextResponse.json(
      {
        error: err.message,
        ranStatements: ran,
        totalStatements: statements.length,
        failedStatement,
      },
      { status: 500 }
    );
  }
}
