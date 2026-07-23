import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
    const siteRows = await sql`
      SELECT id, site_name, site_topic, leader_name, sort_order, hostname, division, excluded_from_aggregation
      FROM sites WHERE id = ${Number(id)}
    `;
    const site = (siteRows as any[])[0];
    if (!site) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }
    const scores = await sql`
      SELECT site_id, category, score::float8 AS score, note, is_canonized, updated_at, updated_by
      FROM scores WHERE site_id = ${Number(id)}
    `;
    return NextResponse.json({ site: { ...site, scores } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const { leaderName } = await req.json();
  if (typeof leaderName !== "string" || !leaderName.trim()) {
    return NextResponse.json({ error: "Enter a leader name." }, { status: 400 });
  }
  try {
    await sql`UPDATE sites SET leader_name = ${leaderName.trim()} WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
