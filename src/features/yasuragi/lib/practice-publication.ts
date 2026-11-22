/** P04 release-readiness rules. No client flag can override a missing live-library dependency. */
import type { PracticeScript } from "./practice-types";
import type { AuthoringImportReport } from "./practice-authoring";
import type { ProjectReview } from "./practice-review";

export const YASURAGI_REVIEW_FORMAT = "yasuragi.practice-review.v1";
export type EditorialAttestations = {
  scriptReviewed: boolean;
  movementReviewed: boolean;
  previewChecked: boolean;
};
export type ReleaseBlocker = { code: string; label: string; poseId?: string };
export type PublicationGate = {
  eligible: boolean;
  blockers: ReleaseBlocker[];
  requiredPoseCount: number;
  libraryFingerprintInput: Array<{ poseId: string; status: string; content: string; validated: boolean; image: string; imageStatus: string; contentDigest: string }>;
  practiceId: string;
  version: string;
};

function isBlocked(value: string | undefined): boolean { return typeof value === "string" && value.startsWith("blocked"); }

/** List only poses reachable in a non-disabled node or selectable option. An orphan proposal is not a publication dependency. */
export function requiredPublicationPoses(script: PracticeScript): string[] {
  const poseIds = new Set<string>();
  const nodes = new Map(script.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (id === script.endNodeId || seen.has(id)) return;
    seen.add(id);
    const node = nodes.get(id);
    if (!node || (node.type === "segment" && isBlocked(node.availability))) return;
    if (node.type === "segment") {
      node.posePool.forEach((poseId) => poseIds.add(poseId));
      visit(node.nextNodeId);
    } else for (const option of node.options) {
      if (isBlocked(option.availability)) continue;
      poseIds.add(option.imagePoseId);
      option.requiresPoseIds?.forEach((poseId) => poseIds.add(poseId));
      visit(option.nextNodeId);
    }
  };
  visit(script.startNodeId);
  return [...poseIds].sort();
}

/** This is a publication *gate*, not an automated yoga/medical judgment. */
export function evaluatePublicationGate(
  script: PracticeScript,
  report: Pick<AuthoringImportReport, "ok" | "errors" | "availableRouteCount" | "previewReady">,
  review: ProjectReview,
): PublicationGate {
  const blockers: ReleaseBlocker[] = [];
  if (!report.ok || report.errors.length) blockers.push({ code: "STRUCTURE", label: "A gyakorlásscript szerkezetét és minden útvonalát javítani kell." });
  if (!report.previewReady || report.availableRouteCount < 1) blockers.push({ code: "PLAYBACK", label: "Nincs teljesen bejárható próbalеjátszási útvonal." });
  const required = requiredPublicationPoses(script);
  const byId = new Map(review.items.map((item) => [item.poseId, item]));
  const libraryFingerprintInput = required.map((poseId) => {
    const item = byId.get(poseId);
    if (!item?.exists) blockers.push({ code: "POSE_MISSING", label: `A póz hiányzik a könyvtárból: ${poseId}`, poseId });
    else if (!item.libraryReady) blockers.push({
      code: "POSE_REVIEW", poseId,
      label: `A póz nem teljesen jóváhagyott (aktív rekord, szakmai validálás, tartalom és kép szükséges): ${item.label}`,
    });
    return { poseId, status: item?.libraryStatus ?? "missing", content: item?.contentStatus ?? "missing",
      validated: item?.validated === true, image: item?.imageAssetRef ?? "", imageStatus: item?.imageStatus ?? "missing",
      contentDigest: item?.contentDigest ?? "" };
  });
  // A frozen review receipt is allowed only for the exact script and the live knowledge state.
  return { eligible: blockers.length === 0, blockers, requiredPoseCount: required.length,
    libraryFingerprintInput, practiceId: script.practiceId, version: script.version };
}

export function attestationsComplete(value: EditorialAttestations): boolean {
  return value.scriptReviewed === true && value.movementReviewed === true && value.previewChecked === true;
}

/** A signoff becomes stale if its immutable source or any referenced live-library state changes. */
export function reviewReceiptIsCurrent(
  gate: PublicationGate,
  receipt: { scriptSha256: string; librarySha256: string } | null,
  currentScriptSha: string,
  currentLibrarySha: string,
): boolean {
  return Boolean(gate.eligible && receipt && receipt.scriptSha256 === currentScriptSha && receipt.librarySha256 === currentLibrarySha);
}
