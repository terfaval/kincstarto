import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_key";

export async function isAdminRequest() {
  const adminKey = process.env.ADMIN_KEY ?? process.env.ADMIN_PASSWORD;
  if (!adminKey) return true;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE)?.value;
  return cookieValue === adminKey;
}

export async function requireAdmin() {
  if (await isAdminRequest()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
