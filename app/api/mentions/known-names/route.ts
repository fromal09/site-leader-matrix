import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    // Everyone who has ever signed in and done anything tracked anywhere in
    // the app — grading, roster edits, traffic uploads, notes — not just
    // people who've left a sticky note before.
    const rows = await sql`
      SELECT DISTINCT name FROM (
        SELECT updated_by AS name FROM scores
        UNION ALL SELECT changed_by FROM score_history
        UNION ALL SELECT updated_by FROM division_notes
        UNION ALL SELECT changed_by FROM leader_changes
        UNION ALL SELECT created_by FROM depth_chart_roles
        UNION ALL SELECT created_by FROM depth_chart_writers
        UNION ALL SELECT updated_by FROM depth_chart_writers
        UNION ALL SELECT imported_by FROM traffic_imports
        UNION ALL SELECT created_by FROM writer_notes
        UNION ALL SELECT created_by FROM ignored_traffic_authors
        UNION ALL SELECT created_by FROM writer_aliases
        UNION ALL SELECT created_by FROM sticky_notes
        UNION ALL SELECT created_by FROM sticky_note_replies
      ) all_names
      WHERE name IS NOT NULL AND name != ''
      ORDER BY name
    `;
    const names = (rows as any[]).map((r) => r.name);
    return NextResponse.json({ names });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
