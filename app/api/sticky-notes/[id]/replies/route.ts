import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const replies = await sql`
      SELECT id, note_id, body, created_by, created_at
      FROM sticky_note_replies
      WHERE note_id = ${Number(id)}
      ORDER BY created_at ASC
    `;
    return NextResponse.json({ replies });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const { body } = await req.json();
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Reply can't be empty." }, { status: 400 });
  }
  try {
    const rows = await sql`
      INSERT INTO sticky_note_replies (note_id, body, created_by)
      VALUES (${Number(id)}, ${body.trim()}, ${session.name})
      RETURNING id, note_id, body, created_by, created_at
    `;
    return NextResponse.json({ reply: (rows as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
