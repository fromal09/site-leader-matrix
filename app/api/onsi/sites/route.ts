import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const sites = await sql`
      SELECT id, site_name, site_topic, leader_name, sort_order, hostname, division
      FROM onsi_sites
      WHERE archived = FALSE
      ORDER BY sort_order ASC, site_name ASC
    `;
    return NextResponse.json({ sites });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.network !== "onsi") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { siteName, siteTopic, leaderName, division } = await req.json();
  if (!siteName || !siteTopic || !division) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  try {
    const rows = await sql`
      INSERT INTO onsi_sites (site_name, site_topic, leader_name, division)
      VALUES (${siteName}, ${siteTopic}, ${leaderName ?? "Vacant"}, ${division})
      RETURNING id, site_name, site_topic, leader_name, sort_order, hostname, division
    `;
    return NextResponse.json({ site: (rows as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
