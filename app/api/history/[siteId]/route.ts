import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  try {
    const rows = await sql`
      SELECT category, score, note, event_type, changed_by, changed_at
      FROM score_history
      WHERE site_id = ${Number(siteId)}
      ORDER BY changed_at DESC
    `;
    return NextResponse.json({ history: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
