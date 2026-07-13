import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SCHEMA_SQL } from "@/lib/schema";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  let ran = 0;
  try {
    for (const stmt of statements) {
      await sql.query(stmt);
      ran++;
    }
    return NextResponse.json({ ok: true, ranStatements: ran });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, ranStatements: ran },
      { status: 500 }
    );
  }
}
