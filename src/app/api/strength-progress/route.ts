import { NextResponse } from "next/server";
import { readActivityLogs } from "@/lib/activityLogs";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const logs = await readActivityLogs();
  const counts: Record<string, number> = {};
  for (const log of logs) {
    if (log.activity_type !== "strength") continue;
    if (!log.exercise_id) continue;
    counts[log.exercise_id] = (counts[log.exercise_id] ?? 0) + 1;
  }

  return NextResponse.json({ counts });
}
