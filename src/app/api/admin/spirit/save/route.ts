import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
// Retired: legacy writes did unconditional overwrite of the public catalog.
// The approved JSON flow is /api/admin/spirit/json with preview and ETag.
export async function POST(request: Request) {
  const rejected = await requireAdmin(request);
  if (rejected) return rejected;
  return NextResponse.json({ error: "A régi könyvmentés le van tiltva. Használd az admin + JSON-importot." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
