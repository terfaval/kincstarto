import { NextResponse } from "next/server";
import { createLogId, readActivityLogs, writeActivityLogs } from "@/lib/activityLogs";
import { createYogaId, findYogaEntry, readYogaLibrary, writeYogaLibrary } from "@/lib/yogaLibrary";
import { requireAdmin } from "@/lib/adminAuth";
import { validateYogiKnowledgeMetadata } from "@/lib/yogiKnowledgeMetadata";
import type { ActivityLogRow, ActivityType, YogaCategory, YogaLibraryEntry } from "@/types/activity";

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toYogaIntensity(value: unknown): YogaLibraryEntry["intensity"] {
  const num = toNumber(value);
  if (num === 1 || num === 2 || num === 3) return num;
  return null;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildMetadata(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

function extractLink(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  const link = metadata.link;
  return typeof link === "string" && link.trim() ? link.trim() : null;
}

function updateYogaEntry(
  entry: YogaLibraryEntry,
  next: {
    label: string;
    category: YogaCategory;
    duration_minutes: number | null;
    intensity: YogaLibraryEntry["intensity"];
    link: string | null;
  }
) {
  const updated: YogaLibraryEntry = {
    ...entry,
    label: next.label || entry.label,
    category: next.category || entry.category,
    duration_minutes: next.duration_minutes ?? entry.duration_minutes ?? null,
    intensity: next.intensity ?? entry.intensity ?? null,
    link: next.link ?? entry.link ?? null,
    updated_at: new Date().toISOString(),
  };
  return updated;
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
  const metadata = buildMetadata(payload.metadata);
  if (metadata && "yogi_knowledge" in metadata) {
    const validation = validateYogiKnowledgeMetadata((metadata as Record<string, unknown>).yogi_knowledge);
    if (!validation.ok) {
      return NextResponse.json({ error: "Invalid yogi_knowledge metadata", detail: validation.error }, { status: 400 });
    }
  }
  const link = extractLink(metadata);

  const newLog: ActivityLogRow = {
    id: createLogId(),
    date,
    activity_type: activityType,
    category,
    exercise_id: payload.exercise_id ?? null,
    yoga_id: payload.yoga_id ?? null,
    label,
    duration_minutes: toNumber(payload.duration_minutes),
    distance_km: toNumber(payload.distance_km),
    intensity: toNumber(payload.intensity),
    notes: cleanText(payload.notes) || null,
    metadata,
    user_id: payload.user_id ?? null,
    created_at: now,
    updated_at: now,
  };

  const logs = await readActivityLogs();

  if (activityType === "yoga") {
    if (link) {
      const duplicate = logs.find((log) => {
        if (!log.metadata || typeof log.metadata !== "object") return false;
        return extractLink(log.metadata as Record<string, unknown>) === link;
      });
      if (duplicate) {
        return NextResponse.json({ error: "duplicate_link", log: duplicate }, { status: 409 });
      }
    }

    const library = await readYogaLibrary();
    const entryCandidate = {
      label,
      category: category as YogaCategory,
      duration_minutes: newLog.duration_minutes ?? null,
      intensity: toYogaIntensity(newLog.intensity),
      link,
    };
    const existing = findYogaEntry(library, entryCandidate);
    if (existing) {
      const updated = updateYogaEntry(existing, entryCandidate);
      const changed =
        updated.label !== existing.label ||
        updated.category !== existing.category ||
        updated.duration_minutes !== existing.duration_minutes ||
        updated.intensity !== existing.intensity ||
        updated.link !== existing.link;
      if (changed) {
        const nextLibrary = library.map((item) => (item.id === existing.id ? updated : item));
        await writeYogaLibrary(nextLibrary);
      }
      newLog.yoga_id = existing.id;
    } else {
      const created: YogaLibraryEntry = {
        id: createYogaId(),
        label: entryCandidate.label,
        category: entryCandidate.category,
        duration_minutes: entryCandidate.duration_minutes,
        intensity: entryCandidate.intensity,
        link: entryCandidate.link,
        created_at: now,
        updated_at: now,
      };
      await writeYogaLibrary([...library, created]);
      newLog.yoga_id = created.id;
    }
  }

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
  const metadata = payload.metadata !== undefined ? buildMetadata(payload.metadata) : current.metadata;
  if (metadata && "yogi_knowledge" in metadata) {
    const validation = validateYogiKnowledgeMetadata((metadata as Record<string, unknown>).yogi_knowledge);
    if (!validation.ok) {
      return NextResponse.json({ error: "Invalid yogi_knowledge metadata", detail: validation.error }, { status: 400 });
    }
  }
  const link = extractLink(metadata);

  const updated: ActivityLogRow = {
    ...current,
    date: cleanText(payload.date) || current.date,
    activity_type: (payload.activity_type as ActivityType | undefined) ?? current.activity_type,
    category: cleanText(payload.category) || current.category,
    exercise_id: payload.exercise_id ?? current.exercise_id,
    yoga_id: payload.yoga_id ?? current.yoga_id,
    label: cleanText(payload.label) || current.label,
    duration_minutes: payload.duration_minutes !== undefined ? toNumber(payload.duration_minutes) : current.duration_minutes,
    distance_km: payload.distance_km !== undefined ? toNumber(payload.distance_km) : current.distance_km,
    intensity: payload.intensity !== undefined ? toNumber(payload.intensity) : current.intensity,
    notes: payload.notes !== undefined ? cleanText(payload.notes) || null : current.notes,
    metadata,
    updated_at: new Date().toISOString(),
  };

  if (updated.activity_type === "yoga") {
    if (link) {
      const duplicate = logs.find((log) => {
        if (log.id === updated.id) return false;
        if (!log.metadata || typeof log.metadata !== "object") return false;
        return extractLink(log.metadata as Record<string, unknown>) === link;
      });
      if (duplicate) {
        return NextResponse.json({ error: "duplicate_link", log: duplicate }, { status: 409 });
      }
    }

    const library = await readYogaLibrary();
    const entryCandidate = {
      label: updated.label,
      category: updated.category as YogaCategory,
      duration_minutes: updated.duration_minutes ?? null,
      intensity: toYogaIntensity(updated.intensity),
      link,
    };
    const existing = findYogaEntry(library, entryCandidate);
    if (existing) {
      const updatedEntry = updateYogaEntry(existing, entryCandidate);
      const changed =
        updatedEntry.label !== existing.label ||
        updatedEntry.category !== existing.category ||
        updatedEntry.duration_minutes !== existing.duration_minutes ||
        updatedEntry.intensity !== existing.intensity ||
        updatedEntry.link !== existing.link;
      if (changed) {
        const nextLibrary = library.map((item) => (item.id === existing.id ? updatedEntry : item));
        await writeYogaLibrary(nextLibrary);
      }
      updated.yoga_id = existing.id;
    } else {
      const now = new Date().toISOString();
      const created: YogaLibraryEntry = {
        id: createYogaId(),
        label: entryCandidate.label,
        category: entryCandidate.category,
        duration_minutes: entryCandidate.duration_minutes,
        intensity: entryCandidate.intensity as YogaLibraryEntry["intensity"],
        link: entryCandidate.link,
        created_at: now,
        updated_at: now,
      };
      await writeYogaLibrary([...library, created]);
      updated.yoga_id = created.id;
    }
  }

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
