import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_COOKIE,
  LONG_SESSION_SECONDS,
  SHORT_SESSION_SECONDS,
  createAdminSession,
  getAdminSecret,
  isSameOriginMutation,
} from "@/lib/adminSession";

type Payload = {
  email?: string;
  password?: string;
  remember?: boolean;
};

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminSecret = getAdminSecret();
  if (!adminEmail?.trim() || !adminPassword?.trim() || !adminSecret) {
    return NextResponse.json({ error: "Admin login not configured" }, { status: 503 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const remember = payload.remember === true;
  if (email !== adminEmail.trim().toLowerCase() || password !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(adminSecret, remember), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? LONG_SESSION_SECONDS : SHORT_SESSION_SECONDS,
  });
  response.cookies.delete(LEGACY_ADMIN_COOKIE);
  return response;
}
