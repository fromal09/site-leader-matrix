import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const rows = await sql`
      SELECT DISTINCT created_by AS name FROM sticky_notes WHERE created_by IS NOT NULL
      UNION
      SELECT DISTINCT created_by AS name FROM sticky_note_replies WHERE created_by IS NOT NULL
    `;
    const names = (rows as any[]).map((r) => r.name).sort();
    return NextResponse.json({ names });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
