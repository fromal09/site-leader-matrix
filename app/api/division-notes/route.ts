import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const rows = await sql`SELECT content, updated_at, updated_by FROM division_notes WHERE id = 1`;
    return NextResponse.json({ note: (rows as any[])[0] ?? { content: "" } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to edit." }, { status: 401 });
  }
  const { content } = await req.json();
  try {
    await sql`
      UPDATE division_notes
      SET content = ${content ?? ""}, updated_at = now(), updated_by = ${session.name}
      WHERE id = 1
    `;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
