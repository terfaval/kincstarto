import { NextResponse } from "next/server";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";

export async function GET() {
  const store = getYogiKnowledgeStore();
  const anatomy = await store.listAnatomy();
  const active = anatomy.filter((item) => item.status === "active");
  return NextResponse.json({ anatomy: active });
}
