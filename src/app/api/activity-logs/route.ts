import { NextResponse } from "next/server";
import { createLogId, readActivityLogs, writeActivityLogs } from "@/lib/activityLogs";
import { requireAdmin } from "@/lib/adminAuth";
import type { ActivityLogRow, ActivityType } from "@/types/activity";

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildMetadata(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

function sortLogs(logs: ActivityLogRow[]) {
  return [...logs].sort((a, b) => {
    if (a.date === b.date) {
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    }
    return a.date.localeCompare(b.date);
  });
}

export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  if (!month) {
    return NextResponse.json({ error: "Missing month" }, { status: 400 });
  }

  const logs = await readActivityLogs();
  const filtered = logs.filter((log) => log.date.startsWith(month));
  return NextResponse.json({ logs: sortLogs(filtered) });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const payload = (await request.json()) as Partial<ActivityLogRow>;
  const date = cleanText(payload.date);
  const activityType = payload.activity_type as ActivityType | undefined;
  const category = cleanText(payload.category);
  const label = cleanText(payload.label);

  if (!date || !activityType || !category || !label) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const newLog: ActivityLogRow = {
    id: createLogId(),
    date,
    activity_type: activityType,
    category,
    exercise_id: payload.exercise_id ?? null,
    label,
    duration_minutes: toNumber(payload.duration_minutes),
    distance_km: toNumber(payload.distance_km),
    intensity: toNumber(payload.intensity),
    notes: cleanText(payload.notes) || null,
    metadata: buildMetadata(payload.metadata),
    user_id: payload.user_id ?? null,
    created_at: now,
    updated_at: now,
  };

  const logs = await readActivityLogs();
  const next = sortLogs([...logs, newLog]);
  await writeActivityLogs(next);
  return NextResponse.json({ log: newLog });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const payload = (await request.json()) as Partial<ActivityLogRow> & { id?: string };
  const id = cleanText(payload.id);
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const logs = await readActivityLogs();
  const index = logs.findIndex((log) => log.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const current = logs[index];
  const updated: ActivityLogRow = {
    ...current,
    date: cleanText(payload.date) || current.date,
    activity_type: (payload.activity_type as ActivityType | undefined) ?? current.activity_type,
    category: cleanText(payload.category) || current.category,
    exercise_id: payload.exercise_id ?? current.exercise_id,
    label: cleanText(payload.label) || current.label,
    duration_minutes: payload.duration_minutes !== undefined ? toNumber(payload.duration_minutes) : current.duration_minutes,
    distance_km: payload.distance_km !== undefined ? toNumber(payload.distance_km) : current.distance_km,
    intensity: payload.intensity !== undefined ? toNumber(payload.intensity) : current.intensity,
    notes: payload.notes !== undefined ? cleanText(payload.notes) || null : current.notes,
    metadata: payload.metadata !== undefined ? buildMetadata(payload.metadata) : current.metadata,
    updated_at: new Date().toISOString(),
  };

  const next = [...logs];
  next[index] = updated;
  await writeActivityLogs(sortLogs(next));
  return NextResponse.json({ log: updated });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const payload = (await request.json()) as { id?: string };
  const id = cleanText(payload.id);
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const logs = await readActivityLogs();
  const next = logs.filter((log) => log.id !== id);
  await writeActivityLogs(next);
  return NextResponse.json({ ok: true });
}

