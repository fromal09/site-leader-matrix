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
    const writers = await sql`
      SELECT dcw.id, dcw.site_id, dcw.name, dcw.role, dcw.traffic_dashboard_name, dcw.sort_order,
        dcw.created_by, dcw.updated_by, dcw.created_at, dcw.updated_at,
        COALESCE(array_agg(wa.alias) FILTER (WHERE wa.alias IS NOT NULL), '{}') AS aliases
      FROM onsi_depth_chart_writers dcw
      LEFT JOIN onsi_writer_aliases wa ON wa.writer_id = dcw.id
      WHERE dcw.site_id = ${Number(siteId)} AND dcw.archived = FALSE
      GROUP BY dcw.id
      ORDER BY dcw.sort_order ASC, dcw.id ASC
    `;
    return NextResponse.json({ writers });
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
  const { name, role, trafficDashboardName } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Enter the writer's name." }, { status: 400 });
  }
  if (!role || typeof role !== "string" || !role.trim()) {
    return NextResponse.json({ error: "Choose a role." }, { status: 400 });
  }

  try {
    const maxRows = await sql`
      SELECT COALESCE(MAX(sort_order), 0) AS max FROM onsi_depth_chart_writers WHERE site_id = ${Number(siteId)}
    `;
    const nextOrder = Number((maxRows as any[])[0].max) + 1;

    const rows = await sql`
      INSERT INTO onsi_depth_chart_writers
        (site_id, name, role, traffic_dashboard_name, sort_order, created_by, updated_by)
      VALUES
        (${Number(siteId)}, ${name.trim()}, ${role.trim()}, ${trafficDashboardName?.trim() ?? ""}, ${nextOrder}, ${session.name}, ${session.name})
      RETURNING id, site_id, name, role, traffic_dashboard_name, sort_order, created_by, updated_by, created_at, updated_at
    `;
    return NextResponse.json({ writer: (rows as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
