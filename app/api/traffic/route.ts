import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const imports = await sql`
      SELECT ti.id, ti.site_id, s.site_name, s.site_topic, ti.period_key, ti.period_label,
        ti.row_count, ti.imported_by, ti.imported_at
      FROM traffic_imports ti
      JOIN sites s ON s.id = ti.site_id
      ORDER BY ti.imported_at DESC
    `;
    return NextResponse.json({ imports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
