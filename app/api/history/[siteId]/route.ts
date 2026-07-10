import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { siteId } = await params;
  try {
    const rows = await sql`
      SELECT category, score::float8 AS score, note, event_type, changed_by, changed_at
      FROM score_history
      WHERE site_id = ${Number(siteId)}
      ORDER BY changed_at DESC
    `;
    return NextResponse.json({ history: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
