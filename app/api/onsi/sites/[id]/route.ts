import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const rows = await sql`
      SELECT id, site_name, site_topic, leader_name, sort_order, hostname, url_path, division
      FROM onsi_sites WHERE id = ${Number(id)}
    `;
    const site = (rows as any[])[0];
    if (!site) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ site });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
