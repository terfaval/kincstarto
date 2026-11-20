import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, LEGACY_ADMIN_COOKIE, isSameOriginMutation } from "@/lib/adminSession";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(LEGACY_ADMIN_COOKIE);
  return response;
}
