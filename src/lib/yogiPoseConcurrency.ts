import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Pose } from "./yogiKnowledgeSchema";

export class PoseRevisionConflict extends Error {
  constructor() {
    super("Az ászanatár időközben megváltozott. Frissítsd az adatokat, mielőtt újra mentenél.");
    this.name = "PoseRevisionConflict";
  }
}

export function poseContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** First-write migration is allowed only from remote legacy data. If both the
 * canonical Blob and historical immutable revisions exist, ambiguity blocks
 * migration rather than guessing which one is newer.
 */
export function selectLegacyPoseSource(
  latestRevision: readonly Pose[] | null,
  canonicalBlob: readonly Pose[] | null,
): Pose[] {
  if (latestRevision && canonicalBlob &&
      poseContentHash(latestRevision) !== poseContentHash(canonicalBlob)) {
    throw new Error("Legacy pose sources differ (revision vs canonical); manual reconciliation required before migration");
  }
  const selected = latestRevision ?? canonicalBlob;
  if (!selected) throw new Error("Remote legacy pose catalogue missing; refusing local fallback or empty bootstrap");
  return [...selected];
}

export function poseRevisionToken(source: "local" | "legacy", poses: readonly Pose[]): string {
  return `${source}:${poseContentHash(poses)}`;
}

export function assertPoseRevision(expected: string, actual: string): void {
  if (!expected || expected !== actual) throw new PoseRevisionConflict();
}

export async function readLocalPoseSnapshot(path: string): Promise<{ poses: Pose[]; revision: string }> {
  // Do not auto-seed missing, unreadable or invalid files: fail closed.
  const data: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(data)) throw new Error("Invalid local pose catalogue");
  return { poses: data as Pose[], revision: poseRevisionToken("local", data as Pose[]) };
}

export async function commitLocalPoseSnapshot(
  path: string,
  items: Pose[],
  expectedRevision: string,
  options: { attempts?: number; pauseMs?: number } = {},
): Promise<string> {
  const lockPath = `${path}.write-lock`;
  await mkdir(dirname(path), { recursive: true });
  const attempts = options.attempts ?? 25;
  const pauseMs = options.pauseMs ?? 75;
  let acquired = false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await mkdir(lockPath);
      acquired = true;
      break;
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause;
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
  if (!acquired) throw new Error("Pose catalogue is locked by another editor; retry after verifying the current state");
  const tempPath = `${path}.${randomUUID()}.tmp`;
  try {
    const current = await readLocalPoseSnapshot(path);
    assertPoseRevision(expectedRevision, current.revision);
    const nextRevision = poseRevisionToken("local", items);
    // Use a same-directory temporary file and atomic rename (never truncate the existing JSON).
    const file = await open(tempPath, "wx");
    try {
      await file.writeFile(JSON.stringify(items, null, 2) + "\n", "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(tempPath, path);
    return nextRevision;
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
    await rm(lockPath, { recursive: true, force: true });
  }
}

/** CAS commit algorithm shared by the real Blob adapter and deterministic fake adapters.
 * The prepared revision is immutable; only the head swap makes it live.
 */
export async function commitPosePointerVersion<T>(params: {
  expectedRevision: string;
  currentEtag: string;
  prepareRevision: () => Promise<T>;
  compareAndSwapHead: (revision: T, etag: string) => Promise<string>;
}): Promise<string> {
  assertPoseRevision(params.expectedRevision, `head:${params.currentEtag}`);
  const revision = await params.prepareRevision();
  return `head:${await params.compareAndSwapHead(revision, params.currentEtag)}`;
}
