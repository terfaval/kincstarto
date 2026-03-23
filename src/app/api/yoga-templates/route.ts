import { NextResponse } from "next/server";
import { readActivityLogs } from "@/lib/activityLogs";
import { requireAdmin } from "@/lib/adminAuth";

type YogaTemplate = {
  category: string;
  label: string;
  duration_minutes: number | null;
  intensity: number | null;
  link: string | null;
};

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const logs = await readActivityLogs();
  const map = new Map<string, YogaTemplate>();

  logs
    .filter((log) => log.activity_type === "yoga")
    .forEach((log) => {
      const link =
        log.metadata && typeof log.metadata === "object" && typeof log.metadata.link === "string"
          ? log.metadata.link
          : null;
      const key = [
        log.category,
        log.label,
        log.duration_minutes ?? "",
        log.intensity ?? "",
        link ?? "",
      ].join("|");
      if (!map.has(key)) {
        map.set(key, {
          category: log.category,
          label: log.label,
          duration_minutes: log.duration_minutes ?? null,
          intensity: log.intensity ?? null,
          link,
        });
      }
    });

  return NextResponse.json({ templates: Array.from(map.values()) });
}

