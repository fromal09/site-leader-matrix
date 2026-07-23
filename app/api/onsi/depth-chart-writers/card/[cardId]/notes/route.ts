import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { cardId } = await params;
  try {
    const notes = await sql`
      SELECT id, content, created_by, created_at
      FROM onsi_writer_notes
      WHERE writer_id = ${Number(cardId)}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ notes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { cardId } = await params;
  const { content } = await req.json();
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Note can't be empty." }, { status: 400 });
  }
  try {
    const rows = await sql`
      INSERT INTO onsi_writer_notes (writer_id, content, created_by)
      VALUES (${Number(cardId)}, ${content.trim()}, ${session.name})
      RETURNING id, content, created_by, created_at
    `;
    return NextResponse.json({ note: (rows as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
