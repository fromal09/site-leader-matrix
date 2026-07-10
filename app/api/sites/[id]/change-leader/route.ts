import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const siteId = Number(id);
  const { newLeader } = await req.json();

  if (!newLeader || typeof newLeader !== "string" || !newLeader.trim()) {
    return NextResponse.json({ error: "Enter the new leader's name." }, { status: 400 });
  }

  try {
    const rows = await sql`SELECT leader_name FROM sites WHERE id = ${siteId}`;
    const oldLeader = (rows as any[])[0]?.leader_name;
    if (oldLeader === undefined) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    const trimmed = newLeader.trim();

    await sql`UPDATE sites SET leader_name = ${trimmed} WHERE id = ${siteId}`;
    await sql`
      INSERT INTO leader_changes (site_id, old_leader, new_leader, changed_by)
      VALUES (${siteId}, ${oldLeader}, ${trimmed}, ${session.name})
    `;
    // New leader means the current scores need fresh eyes before they count as official.
    await sql`UPDATE scores SET is_canonized = FALSE WHERE site_id = ${siteId}`;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
