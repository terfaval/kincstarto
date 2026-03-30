import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const store = getYogiKnowledgeStore();
  const poses = await store.listPoses();
  return NextResponse.json({ poses });
}
