import { NextResponse } from "next/server";
import { readYogaVideoMeta } from "@/lib/yogaVideoMetaStore";

export async function GET() {
  const items = await readYogaVideoMeta();
  return NextResponse.json({ items });
}
