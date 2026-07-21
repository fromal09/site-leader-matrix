import { NextRequest, NextResponse } from "next/server";
import { createSession, clearSession, getSession, type Network } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}

export async function POST(req: NextRequest) {
  const { password, name } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  let network: Network | null = null;
  if (password === process.env.SITE_PASSWORD) {
    network = "fansided";
  } else if (password === process.env.ONSI_SITE_PASSWORD) {
    network = "onsi";
  }

  if (!network) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await createSession(name.trim(), network);
  return NextResponse.json({ ok: true, name: name.trim(), network });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
