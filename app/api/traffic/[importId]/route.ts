import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { importId } = await params;
  try {
    const importRows = await sql`
      SELECT ti.id, ti.site_id, s.site_name, s.site_topic, ti.period_key, ti.period_label,
        ti.row_count, ti.imported_by, ti.imported_at
      FROM traffic_imports ti
      JOIN sites s ON s.id = ti.site_id
      WHERE ti.id = ${Number(importId)}
    `;
    const importRow = (importRows as any[])[0];
    if (!importRow) {
      return NextResponse.json({ error: "Import not found." }, { status: 404 });
    }
    const articles = await sql`
      SELECT article_title, article_author, article_url, first_published_date, pageviews, scroll_depth, avg_time_on_page
      FROM article_traffic
      WHERE import_id = ${Number(importId)}
      ORDER BY pageviews DESC
    `;
    return NextResponse.json({ import: importRow, articles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { importId } = await params;
  try {
    await sql`DELETE FROM traffic_imports WHERE id = ${Number(importId)}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
