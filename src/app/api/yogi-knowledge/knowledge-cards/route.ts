import { requireAdmin } from "@/lib/adminAuth";
import { NextResponse } from "next/server";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const store = getYogiKnowledgeStore();
  const cards = await store.listKnowledgeCards();
  const active = cards.filter((item) => item.status === "active");
  return NextResponse.json({ knowledge_cards: active });
}
