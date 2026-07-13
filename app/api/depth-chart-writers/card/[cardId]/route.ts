import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { cardId } = await params;
  const { name, role, trafficDashboardName } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Enter the writer's name." }, { status: 400 });
  }
  if (!role || typeof role !== "string" || !role.trim()) {
    return NextResponse.json({ error: "Choose a role." }, { status: 400 });
  }

  try {
    const rows = await sql`
      UPDATE depth_chart_writers
      SET name = ${name.trim()},
          role = ${role.trim()},
          traffic_dashboard_name = ${trafficDashboardName?.trim() ?? ""},
          updated_by = ${session.name},
          updated_at = now()
      WHERE id = ${Number(cardId)}
      RETURNING id, site_id, name, role, traffic_dashboard_name, sort_order, created_by, updated_by, created_at, updated_at
    `;
    return NextResponse.json({ writer: (rows as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { cardId } = await params;
  try {
    await sql`UPDATE depth_chart_writers SET archived = TRUE WHERE id = ${Number(cardId)}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
