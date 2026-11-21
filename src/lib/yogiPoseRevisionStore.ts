import { randomUUID } from "node:crypto";
import { get, list, put, type BlobAccessType } from "@vercel/blob";
import type { Pose } from "./yogiKnowledgeSchema";
import { isBlobEnabled } from "./jsonStore";
import { findLatestPoseRevision, YOGI_POSE_REVISION_PREFIX } from "./yogiPoseRevisionCore";

const ACCESS: BlobAccessType = process.env.BLOB_ACCESS?.toLowerCase() === "private" ? "private" : "public";

/**
 * Once the first revision exists, it is authoritative. This avoids reopening
 * cached public yogi/poses.json after an overwrite (which can serve stale data).
 * Never silently fall back to repository data when a revision cannot be read.
 */
export async function readLatestYogiPoseRevision(): Promise<Pose[] | null> {
  if (!isBlobEnabled()) return null;
  const latest = await findLatestPoseRevision(async (cursor) => {
    const page = await list({ prefix: YOGI_POSE_REVISION_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    return { blobs: page.blobs, hasMore: page.hasMore, cursor: page.cursor };
  });

  if (!latest) return null; // Backward compatibility before the first revised save.
  // A unique immutable pathname is not affected by the cache of overwritten poses.json.
  const result = await get(latest.url, { access: ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Cannot read the latest persisted Yasuragi poses revision");
  }
  const data: unknown = JSON.parse(await new Response(result.stream).text());
  if (!Array.isArray(data)) throw new Error("The latest Yasuragi poses revision is invalid");
  return data as Pose[];
}

/**
 * Write an immutable, separately addressable snapshot; never overwrite it.
 * Old revisions are intentionally retained for recovery and must not be
 * automatically treated as unreferenced when cleaning up image assets.
 */
export async function writeYogiPoseRevision(poses: Pose[]): Promise<void> {
  if (!isBlobEnabled()) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathname = `${YOGI_POSE_REVISION_PREFIX}${stamp}-${randomUUID()}.json`;
  const payload = JSON.stringify(poses, null, 2) + "\n";
  const saved = await put(pathname, payload, { access: ACCESS, contentType: "application/json" });
  // Confirm that the freshly written, immutable object can be read back in full.
  // A successful write to the legacy path alone is never considered durable.
  const verification = await get(saved.url, { access: ACCESS });
  if (!verification || verification.statusCode !== 200 || !verification.stream ||
      (await new Response(verification.stream).text()) !== payload) {
    throw new Error("Yasuragi pose revision could not be verified after storage write");
  }
}
