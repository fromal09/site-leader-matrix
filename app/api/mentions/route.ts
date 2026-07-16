import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const name = req.nextUrl.searchParams.get("name") ?? session.name;
  try {
    const rows = await sql`
      SELECT
        m.id, m.mentioned_name, m.created_by, m.created_at, m.note_id, m.reply_id,
        COALESCE(sn.subject_type, sn2.subject_type) AS subject_type,
        COALESCE(sn.subject_id, sn2.subject_id) AS subject_id,
        COALESCE(sn.body, r.body) AS excerpt
      FROM sticky_note_mentions m
      LEFT JOIN sticky_notes sn ON sn.id = m.note_id
      LEFT JOIN sticky_note_replies r ON r.id = m.reply_id
      LEFT JOIN sticky_notes sn2 ON sn2.id = r.note_id
      WHERE LOWER(m.mentioned_name) = LOWER(${name}) AND m.read_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json({ mentions: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
