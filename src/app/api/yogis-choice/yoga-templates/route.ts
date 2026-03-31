import { NextResponse } from "next/server";
import { readYogaLibrary } from "@/lib/yogaLibrary";

type YogaTemplate = {
  id: string;
  category: string;
  label: string;
  duration_minutes: number | null;
  intensity: number | null;
  link: string | null;
};

export async function GET() {
  const library = await readYogaLibrary();
  const templates: YogaTemplate[] = library.map((entry) => ({
    id: entry.id,
    category: entry.category,
    label: entry.label,
    duration_minutes: entry.duration_minutes ?? null,
    intensity: entry.intensity ?? null,
    link: entry.link ?? null,
  }));

  return NextResponse.json({ templates });
}
