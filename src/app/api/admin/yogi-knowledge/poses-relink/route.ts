import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import type { Pose } from "@/lib/yogiKnowledgeSchema";

const DEFAULT_LIMIT = 8;

function normalizeToken(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTagSet(pose: Pose) {
  return new Set(
    (pose.tags ?? [])
      .map((tag) => normalizeToken(String(tag)))
      .filter((tag) => tag.length > 0),
  );
}

function intersectCount(a: Set<string>, b: Set<string>) {
  let count = 0;
  a.forEach((item) => {
    if (b.has(item)) count += 1;
  });
  return count;
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const payload = await request.json().catch(() => null);
  const limit =
    typeof payload?.limit === "number" && Number.isFinite(payload.limit) && payload.limit > 0
      ? Math.min(20, Math.max(1, Math.floor(payload.limit)))
      : DEFAULT_LIMIT;

  const store = getYogiKnowledgeStore();
  const poses = await store.listPoses();
  if (!Array.isArray(poses) || poses.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, total: 0, poses: [] });
  }

  const publishedPool = poses.filter((pose) => pose.content_status === "published");
  const pool = publishedPool.length > 0 ? publishedPool : poses;

  const tagSets = new Map<string, Set<string>>();
  const purposeSets = new Map<string, Set<string>>();

  poses.forEach((pose) => {
    tagSets.set(pose.id, buildTagSet(pose));
    purposeSets.set(pose.id, new Set(pose.purpose ?? []));
  });

  const updatedPoses = poses.map((pose) => {
    const poseTags = tagSets.get(pose.id) ?? new Set<string>();
    const posePurposes = purposeSets.get(pose.id) ?? new Set<string>();

    const scored = pool
      .filter((candidate) => candidate.id !== pose.id)
      .map((candidate) => {
        const candidateTags = tagSets.get(candidate.id) ?? new Set<string>();
        const candidatePurposes = purposeSets.get(candidate.id) ?? new Set<string>();

        const sharedTags = intersectCount(poseTags, candidateTags);
        const sharedPurposes = intersectCount(posePurposes, candidatePurposes);

        let score = 0;
        score += sharedTags * 1;
        score += sharedPurposes * 2;
        if (pose.category === candidate.category) score += 3;
        if (pose.level === candidate.level) score += 2;

        return { candidate, score };
      })
      .filter((entry) => entry.score >= 2)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.candidate.name_hu.localeCompare(b.candidate.name_hu, "hu");
      })
      .slice(0, limit);

    let related =
      scored.length > 0
        ? scored.map((entry) => entry.candidate.id)
        : pool
            .filter((candidate) => candidate.id !== pose.id)
            .sort((a, b) => {
              const catA = a.category === pose.category ? 1 : 0;
              const catB = b.category === pose.category ? 1 : 0;
              if (catB !== catA) return catB - catA;
              const lvlA = a.level === pose.level ? 1 : 0;
              const lvlB = b.level === pose.level ? 1 : 0;
              if (lvlB !== lvlA) return lvlB - lvlA;
              return a.name_hu.localeCompare(b.name_hu, "hu");
            })
            .slice(0, limit)
            .map((candidate) => candidate.id);

    return {
      ...pose,
      related_pose_ids: related,
    };
  });

  let updatedCount = 0;
  updatedPoses.forEach((pose, index) => {
    const before = poses[index]?.related_pose_ids ?? [];
    const after = pose.related_pose_ids ?? [];
    if (before.length !== after.length || before.some((id, i) => id !== after[i])) {
      updatedCount += 1;
    }
  });

  await store.savePoses(updatedPoses);

  return NextResponse.json({
    ok: true,
    updated: updatedCount,
    total: updatedPoses.length,
    poses: updatedPoses,
  });
}
