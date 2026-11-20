import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSecret,
  isSameOriginMutation,
  verifyAdminSession,
} from "@/lib/adminSession";

export async function isAdminRequest() {
  const secret = getAdminSecret();
  if (!secret) return false; // Missing configuration must always fail closed.
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, secret);
}

export async function requireAdmin(request?: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && !isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return null;
}
