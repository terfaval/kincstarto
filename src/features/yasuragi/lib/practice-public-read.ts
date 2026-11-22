import "server-only";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import type { Pose } from "@/lib/yogiKnowledgeSchema";
import { getProjectReview } from "./practice-review";
import { digestReviewInput } from "./practice-approval-store";
import { evaluatePublicationGate } from "./practice-publication";
import { listActivePublicReleases, readPublicPractice } from "./practice-release-store";
import { publicSummary, type PublicRelease, type PublicPracticeSummary } from "./practice-release-core";

/** A released snapshot is frozen, but must not stay playable after a required live pose changes. */
export function publicReleaseIsCurrent(release: PublicRelease, library: readonly Pose[]): boolean {
  const review = getProjectReview(release.script, [], library);
  const gate = evaluatePublicationGate(release.script, {
    ok: true, errors: [], availableRouteCount: 1, previewReady: true,
  }, review);
  return gate.eligible && digestReviewInput(gate.libraryFingerprintInput) === release.librarySha256;
}
export async function readCurrentPublicPractice(practiceId: string): Promise<PublicRelease | null> {
  const release = await readPublicPractice(practiceId);
  if (!release) return null;
  const library = await getYogiKnowledgeStore().listPoses();
  return publicReleaseIsCurrent(release, library) ? release : null;
}
export async function listCurrentPublicPractices(): Promise<PublicPracticeSummary[]> {
  const releases = await listActivePublicReleases();
  if (!releases.length) return [];
  const library = await getYogiKnowledgeStore().listPoses();
  return releases.filter((x) => publicReleaseIsCurrent(x, library))
    .map(publicSummary);
}
