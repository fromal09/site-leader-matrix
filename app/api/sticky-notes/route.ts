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
      SELECT id, subject_type, subject_id, field_label, color, body, pos_x, pos_y, created_by, created_at
      FROM sticky_notes
      WHERE subject_type = ${subjectType} AND subject_id = ANY(${subjectIds}::text[])
        AND deleted_at IS NULL
      ORDER BY created_at ASC
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
    return NextResponse.json({ note: (rows as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
