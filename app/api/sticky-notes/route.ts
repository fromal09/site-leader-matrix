import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const subjectType = req.nextUrl.searchParams.get("subjectType");
  const subjectIdsParam = req.nextUrl.searchParams.get("subjectIds");
  if (!subjectType || !subjectIdsParam) {
    return NextResponse.json({ error: "Missing subjectType or subjectIds." }, { status: 400 });
  }
  const subjectIds = subjectIdsParam.split(",").filter(Boolean);
  if (subjectIds.length === 0) {
    return NextResponse.json({ notes: [] });
  }

  try {
    const notes = await sql`
      SELECT sn.id, sn.subject_type, sn.subject_id, sn.field_label, sn.color, sn.body,
        sn.pos_x, sn.pos_y, sn.created_by, sn.created_at,
        COUNT(r.id)::int AS reply_count
      FROM sticky_notes sn
      LEFT JOIN sticky_note_replies r ON r.note_id = sn.id
      WHERE sn.subject_type = ${subjectType} AND sn.subject_id = ANY(${subjectIds}::text[])
        AND sn.deleted_at IS NULL
      GROUP BY sn.id
      ORDER BY sn.created_at ASC
    `;
    return NextResponse.json({ notes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { subjectType, subjectId, fieldLabel, color, body, posX, posY } = await req.json();
  if (!subjectType || !subjectId || !body || !body.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO sticky_notes (subject_type, subject_id, field_label, color, body, pos_x, pos_y, created_by)
      VALUES (
        ${subjectType}, ${String(subjectId)}, ${fieldLabel ?? null}, ${color ?? "yellow"}, ${body.trim()},
        ${posX ?? null}, ${posY ?? null}, ${session.name}
      )
      RETURNING id, subject_type, subject_id, field_label, color, body, pos_x, pos_y, created_by, created_at
    `;
    return NextResponse.json({ note: { ...(rows as any[])[0], reply_count: 0 } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
