import "server-only";
import { resolveYogiImageUrl } from "@/lib/yogiImageUrl";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import type { Pose } from "@/lib/yogiKnowledgeSchema";
import type { PosePreview, PracticeScript } from "./practice-types";
import { toClientPosePreviews } from "./practice-preview-bridge";

export function buildYasuragiPosePreviews(all: readonly Pose[], script?: PracticeScript): Record<string, PosePreview> {
  const wanted = script ? new Set<string>() : null;
  if (wanted && script) for (const node of script.nodes) {
    if (node.type === "segment") node.posePool.forEach((id) => wanted.add(id));
    else node.options.forEach((option) => {
      wanted.add(option.imagePoseId);
      option.requiresPoseIds?.forEach((id) => wanted.add(id));
    });
  }
  const previews: Record<string, PosePreview> = Object.create(null);
  for (const pose of all) {
    if (pose.status !== "active" || (wanted && !wanted.has(pose.id))) continue;
    previews[pose.id] = {
      id: pose.id,
      name: pose.name_hu,
      sanskrit: pose.sanskrit_name ?? null,
      imageUrl: resolveYogiImageUrl(pose.mannequin_angled?.asset_ref),
      setup: pose.setup,
      modifications: pose.modifications.slice(0, 3),
      cautionAreas: pose.caution_areas.slice(0, 3),
      validated: pose.validated,
    };
  }
  return toClientPosePreviews(previews);
}

export async function loadYasuragiPosePreviews(script?: PracticeScript): Promise<Record<string, PosePreview>> {
  return buildYasuragiPosePreviews(await getYogiKnowledgeStore().listPoses(), script);
}
