import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const notes = await sql`
      SELECT id, subject_type, subject_id, field_label, color, body,
        created_by, created_at, deleted_by, deleted_at
      FROM sticky_notes
      ORDER BY COALESCE(deleted_at, created_at) DESC
      LIMIT 200
    `;
    return NextResponse.json({ notes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
