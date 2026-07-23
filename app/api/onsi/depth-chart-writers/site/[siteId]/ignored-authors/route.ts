import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteId } = await params;
  try {
    const rows = await sql`
      SELECT author_name FROM onsi_ignored_traffic_authors WHERE site_id = ${Number(siteId)}
    `;
    return NextResponse.json({ authors: (rows as any[]).map((r) => r.author_name) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteId } = await params;
  const { authorName } = await req.json();
  if (!authorName || typeof authorName !== "string" || !authorName.trim()) {
    return NextResponse.json({ error: "Missing author name." }, { status: 400 });
  }
  try {
    await sql`
      INSERT INTO onsi_ignored_traffic_authors (site_id, author_name, created_by)
      VALUES (${Number(siteId)}, ${authorName.trim()}, ${session.name})
      ON CONFLICT (site_id, author_name) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
