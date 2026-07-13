import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const roles = await sql`
      SELECT id, label, sort_order FROM depth_chart_roles
      ORDER BY sort_order ASC, label ASC
    `;
    return NextResponse.json({ roles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { label } = await req.json();
  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Enter a role name." }, { status: 400 });
  }
  const trimmed = label.trim();

  try {
    const maxRows = await sql`SELECT COALESCE(MAX(sort_order), 0) AS max FROM depth_chart_roles`;
    const nextOrder = Number((maxRows as any[])[0].max) + 1;

    await sql`
      INSERT INTO depth_chart_roles (label, sort_order, created_by)
      VALUES (${trimmed}, ${nextOrder}, ${session.name})
      ON CONFLICT (label) DO NOTHING
    `;
    const rows = await sql`SELECT id, label, sort_order FROM depth_chart_roles WHERE label = ${trimmed}`;
    return NextResponse.json({ role: (rows as any[])[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
