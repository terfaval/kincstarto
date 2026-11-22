import { createHash } from "node:crypto";
import type { PosePreview, PracticeScript } from "./practice-types";

export const RELEASE_FORMAT = "yasuragi.publication-release.v1" as const;
export const HEAD_FORMAT = "yasuragi.publication-head.v1" as const;
export const PUBLICATION_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
export const RELEASE_ID = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;

export type PublicRelease = {
  format: typeof RELEASE_FORMAT;
  releaseId: string;
  practiceId: string;
  version: string;
  title: string;
  durationSec: number;
  publishedAt: string;
  librarySha256: string;
  script: PracticeScript;
  poses: Record<string, PosePreview>;
};
export type PublicationHead = {
  format: typeof HEAD_FORMAT;
  practiceId: string;
  status: "published" | "revoked";
  releaseId: string;
  releaseSha256: string;
  updatedAt: string;
};
export type PublicPracticeSummary = Pick<PublicRelease, "practiceId" | "title" | "version" | "durationSec" | "publishedAt" | "releaseId">;

export function digestRelease(release: PublicRelease): string {
  return createHash("sha256").update(JSON.stringify(release)).digest("hex");
}
export function validHead(value: unknown, expectedPracticeId: string): value is PublicationHead {
  if (!value || typeof value !== "object") return false;
  const head = value as Partial<PublicationHead>;
  return head.format === HEAD_FORMAT && head.practiceId === expectedPracticeId &&
    (head.status === "published" || head.status === "revoked") &&
    typeof head.releaseId === "string" && RELEASE_ID.test(head.releaseId) &&
    typeof head.releaseSha256 === "string" && /^[a-f0-9]{64}$/.test(head.releaseSha256) &&
    typeof head.updatedAt === "string" && !Number.isNaN(Date.parse(head.updatedAt));
}
export function validRelease(value: unknown, practiceId: string, releaseId: string): value is PublicRelease {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PublicRelease>;
  return data.format === RELEASE_FORMAT && data.practiceId === practiceId && data.releaseId === releaseId &&
    typeof data.title === "string" && data.title.length > 0 && data.title.length <= 160 &&
    typeof data.version === "string" && data.version.length > 0 &&
    typeof data.durationSec === "number" && Number.isSafeInteger(data.durationSec) && data.durationSec >= 60 && data.durationSec <= 14400 &&
    typeof data.publishedAt === "string" && !Number.isNaN(Date.parse(data.publishedAt)) &&
    typeof data.librarySha256 === "string" && /^[a-f0-9]{64}$/.test(data.librarySha256) &&
    !!data.script && data.script.practiceId === practiceId && data.script.durationSec === data.durationSec &&
    !!data.poses && typeof data.poses === "object" && !Array.isArray(data.poses);
}
export function publishedRelease(head: PublicationHead | null, release: PublicRelease | null): PublicRelease | null {
  if (!head || head.status !== "published" || !release ||
      head.practiceId !== release.practiceId || head.releaseId !== release.releaseId ||
      head.releaseSha256 !== digestRelease(release)) return null;
  return release;
}
export function publicSummary(release: PublicRelease): PublicPracticeSummary {
  const { practiceId, title, version, durationSec, publishedAt, releaseId } = release;
  return { practiceId, title, version, durationSec, publishedAt, releaseId };
}
export class PublicationConflict extends Error {
  constructor(message = "A gyakorlás publikációs állapota megváltozott. Frissítsd, és ellenőrizd újra.") {
    super(message); this.name = "PublicationConflict";
  }
}

/** Re-check both identity and lifecycle state before attempting a CAS update. */
export function assertPublicationTransition(
  current: PublicationHead | null, expectedReleaseId: string | null,
  expectedStatus: "none" | "published" | "revoked",
): void {
  if ((current?.releaseId ?? null) !== expectedReleaseId || (current?.status ?? "none") !== expectedStatus) {
    throw new PublicationConflict();
  }
}
