import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { name, mentionId } = await req.json();
  const target = name ?? session.name;
  try {
    if (mentionId) {
      await sql`UPDATE sticky_note_mentions SET read_at = now() WHERE id = ${Number(mentionId)}`;
    } else {
      await sql`
        UPDATE sticky_note_mentions SET read_at = now()
        WHERE LOWER(mentioned_name) = LOWER(${target}) AND read_at IS NULL
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
