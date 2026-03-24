import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const ua = request.headers.get("user-agent") ?? "unknown";
  console.error("[client-error]", { ua, payload });
  return NextResponse.json({ ok: true });
}
