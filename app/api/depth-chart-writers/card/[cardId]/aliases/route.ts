import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { cardId } = await params;
  try {
    const rows = await sql`
      SELECT id, alias FROM writer_aliases WHERE writer_id = ${Number(cardId)} ORDER BY alias ASC
    `;
    return NextResponse.json({ aliases: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { cardId } = await params;
  const { alias } = await req.json();
  if (!alias || typeof alias !== "string" || !alias.trim()) {
    return NextResponse.json({ error: "Enter an alias." }, { status: 400 });
  }
  try {
    const rows = await sql`
      INSERT INTO writer_aliases (writer_id, alias, created_by)
      VALUES (${Number(cardId)}, ${alias.trim()}, ${session.name})
      ON CONFLICT (writer_id, alias) DO NOTHING
      RETURNING id, alias
    `;
    if ((rows as any[])[0]) {
      return NextResponse.json({ alias: (rows as any[])[0] });
    }
    const existing = await sql`
      SELECT id, alias FROM writer_aliases WHERE writer_id = ${Number(cardId)} AND alias = ${alias.trim()}
    `;
    return NextResponse.json({ alias: (existing as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
