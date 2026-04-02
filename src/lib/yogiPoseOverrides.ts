import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pose } from "./yogiKnowledgeSchema";

export type PoseOverride = {
  id?: string;
  slug?: string;
  props?: string[];
};

function normalizeKey(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readPoseOverrides(): Promise<PoseOverride[]> {
  const filePath = join(process.cwd(), "data", "yogi", "pose-overrides.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PoseOverride[]) : [];
  } catch {
    return [];
  }
}

export async function applyPoseOverrides(poses: Pose[]): Promise<Pose[]> {
  const overrides = await readPoseOverrides();
  if (overrides.length === 0) return poses;

  return poses.map((pose) => {
    const poseId = normalizeKey(pose.id);
    const poseSlug = normalizeKey(pose.slug);
    const match = overrides.find((override) => {
      const idKey = normalizeKey(override.id);
      const slugKey = normalizeKey(override.slug);
      if (idKey && idKey === poseId) return true;
      if (slugKey && slugKey === poseSlug) return true;
      return false;
    });

    if (!match) return pose;

    return {
      ...pose,
      props: Array.isArray(match.props) ? match.props : pose.props,
    };
  });
}

