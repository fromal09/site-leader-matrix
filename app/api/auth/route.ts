import { NextRequest, NextResponse } from "next/server";
import { createSession, clearSession, getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}

export async function POST(req: NextRequest) {
  const { password, name } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await createSession(name.trim());
  return NextResponse.json({ ok: true, name: name.trim() });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
