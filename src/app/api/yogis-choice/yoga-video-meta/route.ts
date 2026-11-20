import { requireAdmin } from "@/lib/adminAuth";
import { NextResponse } from "next/server";
import { readYogaVideoMeta } from "@/lib/yogaVideoMetaStore";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const items = await readYogaVideoMeta();
  return NextResponse.json({ items });
}
