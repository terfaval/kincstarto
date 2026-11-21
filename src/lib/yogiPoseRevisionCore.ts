/**
 * Immutable pose revisions are named with an ISO UTC timestamp and a UUID.
 * Vercel Blob lists objects lexicographically by pathname, not by upload date.
 * Keep this pure selector independently testable without credentials.
 */
export const YOGI_POSE_REVISION_PREFIX = "yogi/pose-revisions/v1/";

export type PoseRevisionEntry = { pathname: string; url: string };

export function latestPoseRevision(entries: readonly PoseRevisionEntry[]): PoseRevisionEntry | null {
  let latest: PoseRevisionEntry | null = null;
  for (const entry of entries) {
    const filename = entry.pathname.slice(YOGI_POSE_REVISION_PREFIX.length);
    if (!entry.pathname.startsWith(YOGI_POSE_REVISION_PREFIX) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}\.json$/.test(filename)) {
      continue;
    }
    if (!latest || entry.pathname > latest.pathname) latest = entry;
  }
  return latest;
}

/** Traverse every page; Blob list is lexicographically ordered, not upload-date ordered. */
export async function findLatestPoseRevision(
  fetchPage: (cursor?: string) => Promise<{
    blobs: PoseRevisionEntry[];
    hasMore: boolean;
    cursor?: string;
  }>,
): Promise<PoseRevisionEntry | null> {
  let cursor: string | undefined;
  let latest: PoseRevisionEntry | null = null;
  do {
    const page = await fetchPage(cursor);
    if (!Array.isArray(page.blobs)) throw new Error("Invalid Yasuragi revision listing");
    latest = latestPoseRevision([...(latest ? [latest] : []), ...page.blobs]);
    if (!page.hasMore) break;
    if (!page.cursor || page.cursor === cursor) throw new Error("Yasuragi revision listing did not advance");
    cursor = page.cursor;
  } while (true);
  return latest;
}
