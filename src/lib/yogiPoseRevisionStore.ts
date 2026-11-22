import { randomUUID } from "node:crypto";
import { get, head, list, put, BlobNotFoundError, BlobPreconditionFailedError, type BlobAccessType } from "@vercel/blob";
import type { Pose } from "./yogiKnowledgeSchema";
import { isBlobEnabled } from "./jsonStore";
import { assertPoseRevision, poseContentHash, poseRevisionToken, selectLegacyPoseSource, PoseRevisionConflict, commitPosePointerVersion } from "./yogiPoseConcurrency";
import { findLatestPoseRevision, YOGI_POSE_REVISION_PREFIX } from "./yogiPoseRevisionCore";

const ACCESS: BlobAccessType = process.env.BLOB_ACCESS?.toLowerCase() === "private" ? "private" : "public";
// This single CAS pointer is authoritative after the first P05b write. Never use a
// latest-timestamp revision listing to choose live data once this pointer exists.
const HEAD_PATH = "yogi/pose-revisions/head-v1.json";

type PosePointer = { format: "yogi.pose-head.v1"; pathname: string; hash: string };

function pointerValid(value: unknown): value is PosePointer {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<PosePointer>;
  return p.format === "yogi.pose-head.v1" && typeof p.pathname === "string" &&
    p.pathname.startsWith(YOGI_POSE_REVISION_PREFIX) &&
    /^[a-zA-Z0-9/_\-.]+\.json$/.test(p.pathname) &&
    typeof p.hash === "string" && /^[a-f0-9]{64}$/.test(p.hash);
}

export async function readYogiPoseHead(): Promise<{ pointer: PosePointer; etag: string } | null> {
  if (!isBlobEnabled()) return null;
  let info;
  try {
    info = await head(HEAD_PATH);
  } catch (cause) {
    // head() throws BlobNotFoundError; a missing pointer is normal only during
    // the first, explicitly checked legacy migration. Other errors fail closed.
    if (cause instanceof BlobNotFoundError) return null;
    throw cause;
  }
  const result = await get(HEAD_PATH, { access: ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("Cannot read current pose head");
  // A public Blob can be cached; do not pair stale JSON with a newer ETag.
  if (result.blob.etag !== info.etag) throw new Error("Pose head cache is stale; retry shortly");
  const pointer: unknown = JSON.parse(await new Response(result.stream).text());
  // Do not accept a pointer changed between the initial HEAD and the GET.
  const after = await head(HEAD_PATH);
  if (after.etag !== info.etag) throw new Error("Pose head changed while reading; retry");
  if (!pointerValid(pointer)) throw new Error("Invalid pose head; manual recovery is required");
  return { pointer, etag: info.etag };
}

async function readImmutablePoses(pathname: string, expectedHash?: string): Promise<Pose[]> {
  const result = await get(pathname, { access: ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("Cannot read immutable pose revision");
  const value: unknown = JSON.parse(await new Response(result.stream).text());
  if (!Array.isArray(value)) throw new Error("Invalid immutable pose revision");
  if (expectedHash && poseContentHash(value) !== expectedHash) throw new Error("Pose revision checksum mismatch");
  return value as Pose[];
}

export async function readLatestYogiPoseRevision(): Promise<Pose[] | null> {
  if (!isBlobEnabled()) return null;
  const headState = await readYogiPoseHead();
  if (headState) return readImmutablePoses(headState.pointer.pathname, headState.pointer.hash);
  const latest = await findLatestPoseRevision(async (cursor) => {
    const page = await list({ prefix: YOGI_POSE_REVISION_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    return { blobs: page.blobs, hasMore: page.hasMore, cursor: page.cursor };
  });
  return latest ? readImmutablePoses(latest.pathname) : null;
}

/** A first-write migration must read remote Blob records only. Never implicitly
 * bootstrap a production head from the repository's local data/yogi/poses.json.
 * If two legacy sources disagree, stop for operator reconciliation.
 */
export async function readLegacyYogiPoseBlobSnapshot(): Promise<{ poses: Pose[]; revision: string }> {
  if (!isBlobEnabled()) throw new Error("Blob storage unavailable");
  const latest = await readLatestYogiPoseRevision();
  const legacy = await get("yogi/poses.json", { access: ACCESS });
  if (legacy && legacy.statusCode !== 200) throw new Error("Cannot read remote legacy pose catalogue");
  const raw = legacy?.statusCode === 200 && legacy.stream
    ? JSON.parse(await new Response(legacy.stream).text()) as unknown
    : null;
  if (raw !== null && !Array.isArray(raw)) throw new Error("Invalid remote legacy pose catalogue");
  const canonical = raw as Pose[] | null;
  const poses = selectLegacyPoseSource(latest, canonical);
  return { poses, revision: poseRevisionToken("legacy", poses) };
}

export async function readYogiPoseBlobSnapshot(): Promise<{ poses: Pose[]; revision: string } | null> {
  if (!isBlobEnabled()) return null;
  const state = await readYogiPoseHead();
  if (!state) return null;
  return { poses: await readImmutablePoses(state.pointer.pathname, state.pointer.hash), revision: `head:${state.etag}` };
}

async function putImmutableRevision(poses: Pose[]): Promise<PosePointer> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathname = `${YOGI_POSE_REVISION_PREFIX}${stamp}-${randomUUID()}.json`;
  const payload = JSON.stringify(poses, null, 2) + "\n";
  const saved = await put(pathname, payload, { access: ACCESS, contentType: "application/json" });
  const check = await get(saved.url, { access: ACCESS });
  if (!check || check.statusCode !== 200 || !check.stream ||
      (await new Response(check.stream).text()) !== payload) throw new Error("Pose revision verification failed");
  return { format: "yogi.pose-head.v1", pathname, hash: poseContentHash(poses) };
}

async function updatePointer(pointer: PosePointer, etag?: string): Promise<string> {
  try {
    const result = await put(HEAD_PATH, JSON.stringify(pointer), {
      access: ACCESS,
      contentType: "application/json",
      ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
      // Lower bound for public Blob cache is 60s. Stale pointer reads fail closed.
      cacheControlMaxAge: 60,
    });
    return result.etag;
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError ||
        (err as { statusCode?: number }).statusCode === 409 ||
        (err as { statusCode?: number }).statusCode === 412 ||
        (err instanceof Error && /blob already exists/i.test(err.message))) throw new PoseRevisionConflict();
    throw err;
  }
}

export async function commitYogiPoseBlobSnapshot(
  items: Pose[], expectedRevision: string, legacyPoses: Pose[],
): Promise<string> {
  if (!isBlobEnabled()) throw new Error("Blob storage unavailable");
  let state = await readYogiPoseHead();
  if (!state) {
    // Bootstrap from the legacy authoritative snapshot under a create-only pointer.
    // A simultaneous bootstrap is rejected, not silently overwritten.
    assertPoseRevision(expectedRevision, poseRevisionToken("legacy", legacyPoses));
    const original = await putImmutableRevision(legacyPoses);
    const initialEtag = await updatePointer(original);
    state = { pointer: original, etag: initialEtag };
  } else {
    assertPoseRevision(expectedRevision, `head:${state.etag}`);
  }
  // Revisions are immutable; losing CAS can only leave an unreferenced snapshot,
  // never replace the live catalogue.
  return commitPosePointerVersion({
    expectedRevision: `head:${state.etag}`,
    currentEtag: state.etag,
    prepareRevision: () => putImmutableRevision(items),
    compareAndSwapHead: updatePointer,
  });
}
