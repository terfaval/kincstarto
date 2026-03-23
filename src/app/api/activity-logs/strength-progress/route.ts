import { NextResponse } from "next/server";
import { readActivityLogs } from "@/lib/activityLogs";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const workoutId = searchParams.get("workoutId");
  if (!workoutId) {
    return NextResponse.json({ error: "Missing workoutId" }, { status: 400 });
  }

  const logs = await readActivityLogs();
  const count = logs.filter(
    (log) => log.activity_type === "strength" && log.exercise_id === workoutId
  ).length;

  return NextResponse.json({ count });
}

