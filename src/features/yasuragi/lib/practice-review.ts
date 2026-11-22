/** Read-only, aggregated project dependency board. Never grants publication rights. */
import { createHash } from "node:crypto";
import type { Pose } from "@/lib/yogiKnowledgeSchema";
import type { PracticeScript } from "./practice-types";

export type PoseReviewItem = {
  poseId: string;
  label: string;
  referenceCount: number;
  hasProposal: boolean;
  exists: boolean;
  slug: string | null;
  libraryStatus: "missing" | "draft" | "active" | "archived";
  contentStatus: string | null;
  validated: boolean;
  imageStatus: "missing" | "generated" | "verified";
  imageAssetRef: string | null;
  /** Hash of the full canonical pose record, not just workflow flags. */
  contentDigest: string | null;
  libraryReady: boolean;
};
export type ProjectReview = {
  items: PoseReviewItem[];
  missingCount: number;
  unapprovedCount: number;
  libraryReadyCount: number;
  publicationGate: "not_implemented";
};

export function getProjectReview(
  script: PracticeScript,
  proposals: readonly { poseId: string; record: { name_hu: string } }[],
  library: readonly Pose[],
): ProjectReview {
  const references = new Map<string, number>();
  const add = (id: string) => references.set(id, (references.get(id) ?? 0) + 1);
  for (const node of script.nodes) {
    if (node.type === "segment") node.posePool.forEach(add);
    else for (const option of node.options) {
      add(option.imagePoseId);
      option.requiresPoseIds?.forEach(add);
    }
  }
  const byId = new Map(library.map((pose) => [pose.id, pose]));
  const proposed = new Map(proposals.map((proposal) => [proposal.poseId, proposal]));
  // Include orphan proposals as work items, without pretending the script uses them.
  for (const item of proposals) if (!references.has(item.poseId)) references.set(item.poseId, 0);
  const items = [...references.entries()].map(([poseId, referenceCount]): PoseReviewItem => {
    const pose = byId.get(poseId);
    const imageAssetRef = pose?.mannequin_angled?.asset_ref ?? null;
    const imageStatus = pose?.mannequin_angled?.status ?? "missing";
    const libraryStatus = pose?.status ?? "missing";
    const validated = pose?.validated === true;
    const contentDigest = pose ? createHash("sha256").update(JSON.stringify(pose)).digest("hex") : null;
    const libraryReady = libraryStatus === "active" && validated &&
      (pose?.content_status === "verified" || pose?.content_status === "published") &&
      imageStatus === "verified" && Boolean(imageAssetRef);
    return {
      poseId, label: pose?.name_hu ?? proposed.get(poseId)?.record.name_hu ?? poseId,
      referenceCount, hasProposal: proposed.has(poseId), exists: Boolean(pose),
      slug: pose?.slug ?? null, libraryStatus, contentStatus: pose?.content_status ?? null,
      validated, imageStatus, imageAssetRef, contentDigest, libraryReady,
    };
  }).sort((a, b) => Number(b.referenceCount > 0) - Number(a.referenceCount > 0) || a.label.localeCompare(b.label, "hu"));
  return {
    items, missingCount: items.filter((item) => !item.exists).length,
    unapprovedCount: items.filter((item) => item.referenceCount > 0 && !item.libraryReady).length,
    libraryReadyCount: items.filter((item) => item.referenceCount > 0 && item.libraryReady).length,
    publicationGate: "not_implemented",
  };
}

/** Creation preflight: only absent, unapproved records may be appended.
 * Returns a stable reason rather than mutating the source proposal.
 */
export function assessNewPoseDraft(
  poseId: string,
  record: Pick<Pose, "id" | "slug" | "status" | "content_status" | "validated" | "mannequin_angled">,
  library: readonly Pick<Pose, "id" | "slug">[],
  normalize: (slug: string) => string,
): "ok" | "unsafe_state" | "collision" {
  if (record.id !== poseId || record.status !== "draft" || record.content_status !== "draft" ||
      record.validated || record.mannequin_angled.status !== "missing" || record.mannequin_angled.asset_ref !== null) return "unsafe_state";
  const slug = normalize(record.slug);
  if (!slug || library.some((p) => p.id === poseId || normalize(p.slug) === slug)) return "collision";
  return "ok";
}
