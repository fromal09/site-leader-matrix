import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { extractMentions } from "@/lib/mentions";

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
    const reply = (rows as any[])[0];

    const knownNameRows = await sql`
      SELECT DISTINCT name FROM (
        SELECT updated_by AS name FROM scores
        UNION ALL SELECT changed_by FROM score_history
        UNION ALL SELECT updated_by FROM division_notes
        UNION ALL SELECT changed_by FROM leader_changes
        UNION ALL SELECT created_by FROM depth_chart_roles
        UNION ALL SELECT created_by FROM depth_chart_writers
        UNION ALL SELECT updated_by FROM depth_chart_writers
        UNION ALL SELECT imported_by FROM traffic_imports
        UNION ALL SELECT created_by FROM writer_notes
        UNION ALL SELECT created_by FROM ignored_traffic_authors
        UNION ALL SELECT created_by FROM writer_aliases
        UNION ALL SELECT created_by FROM sticky_notes
        UNION ALL SELECT created_by FROM sticky_note_replies
      ) all_names
      WHERE name IS NOT NULL AND name != ''
    `;
    const mentioned = extractMentions(body, (knownNameRows as any[]).map((r) => r.name));
    for (const name of mentioned) {
      if (name.toLowerCase() === session.name.toLowerCase()) continue;
      await sql`
        INSERT INTO sticky_note_mentions (reply_id, mentioned_name, created_by)
        VALUES (${reply.id}, ${name}, ${session.name})
      `;
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
