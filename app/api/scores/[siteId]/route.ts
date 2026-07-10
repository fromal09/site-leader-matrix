import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to edit." }, { status: 401 });
  }

  const { siteId } = await params;
  const siteIdNum = Number(siteId);
  const body = await req.json();
  const { category, score, note } = body as {
    category: string;
    score: number;
    note?: string;
  };

  if (!CATEGORY_KEYS.includes(category as any)) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }
  if (typeof score !== "number" || score < 0 || score > 10) {
    return NextResponse.json({ error: "Score must be 0-10." }, { status: 400 });
  }

  try {
    const existingRows = await sql`
      SELECT is_canonized FROM scores WHERE site_id = ${siteIdNum} AND category = ${category}
    `;
    const existing = (existingRows as any[])[0];
    const noteVal = note ?? "";

    await sql`
      INSERT INTO scores (site_id, category, score, note, is_canonized, updated_at, updated_by)
      VALUES (${siteIdNum}, ${category}, ${score}, ${noteVal}, FALSE, now(), ${session.name})
      ON CONFLICT (site_id, category)
      DO UPDATE SET score = ${score}, note = ${noteVal}, updated_at = now(), updated_by = ${session.name}
    `;

    if (existing?.is_canonized) {
      await sql`
        INSERT INTO score_history (site_id, category, score, note, event_type, changed_by)
        VALUES (${siteIdNum}, ${category}, ${score}, ${noteVal}, 'update', ${session.name})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
