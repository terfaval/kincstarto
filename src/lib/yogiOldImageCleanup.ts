import { del, get, head, list } from "@vercel/blob";

/**
 * This feature remains OFF until a local backup of production yogi/ was
 * independently verified and YASURAGI_BACKUP_MANIFEST_SHA256 is configured.
 * No write/delete operations occur when disabled.
 */
export type YogiCleanupResult =
  | { status: "disabled" }
  | { status: "skipped"; reason: string }
  | { status: "deleted"; pathname: string }
  | { status: "failed"; reason: string };

function blobPathFromUrl(url: string): { host: string; pathname: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.search || parsed.hash) return null;
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".public.blob.vercel-storage.com")) return null;
    const pathname = decodeURIComponent(parsed.pathname.slice(1));
    if (!pathname.startsWith("yogi/images/") || pathname.includes("..") || pathname.includes("\\")) return null;
    return { host, pathname };
  } catch {
    return null;
  }
}

function referencesUrl(data: unknown, url: string): boolean {
  if (typeof data === "string") return data.includes(url);
  if (Array.isArray(data)) return data.some((value) => referencesUrl(value, url));
  if (data && typeof data === "object") return Object.values(data).some((value) => referencesUrl(value, url));
  return false;
}

async function fetchBlobJson(pathname: string): Promise<unknown> {
  let lastError: Error | null = null;
  for (const access of ["public", "private"] as const) {
    try {
      const result = await get(pathname, { access });
      if (result?.statusCode === 200 && result.stream) {
        return JSON.parse(await new Response(result.stream).text()) as unknown;
      }
      lastError = new Error(`Missing data: ${pathname}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`Could not read ${pathname}`);
}

async function allYogiJsonPaths(): Promise<string[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const result = await list({ prefix: "yogi/", limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const entry of result.blobs) if (entry.pathname.endsWith(".json")) paths.push(entry.pathname);
    hasMore = result.hasMore;
    if (hasMore && (!result.cursor || result.cursor === cursor)) throw new Error("Pagination did not advance");
    cursor = result.cursor;
  }
  if (!paths.includes("yogi/poses.json")) throw new Error("Canonical poses.json missing");
  return paths;
}

/** Return a separate cleanup status; failures never undo an already-committed illustration change. */
export async function cleanupSupersededYogiImage(input: {
  previousUrl: string;
  currentUrl: string;
}): Promise<YogiCleanupResult> {
  if (
    process.env.YASURAGI_AUTO_DELETE_OLD_BLOB !== "true" ||
    !/^[a-f0-9]{64}$/i.test(process.env.YASURAGI_BACKUP_MANIFEST_SHA256 ?? "")
  ) return { status: "disabled" };

  if (!input.previousUrl || input.previousUrl === input.currentUrl) return { status: "skipped", reason: "No old image" };
  const previous = blobPathFromUrl(input.previousUrl);
  const current = blobPathFromUrl(input.currentUrl);
  if (!previous || !current || previous.host !== current.host) {
    return { status: "skipped", reason: "Foreign or unrecognized Blob URL" };
  }
  try {
    const paths = await allYogiJsonPaths();
    // Fail closed if ANY stored Yasuragi JSON references the old asset, including
    // auxiliary pose slots, drafts, anatomy records or video metadata.
    for (const pathname of paths) {
      const contents = await fetchBlobJson(pathname);
      if (referencesUrl(contents, input.previousUrl)) {
        return { status: "skipped", reason: `Still referenced in ${pathname}` };
      }
    }
    const oldBlob = await head(input.previousUrl);
    if (!oldBlob || oldBlob.pathname !== previous.pathname || oldBlob.url !== input.previousUrl) {
      return { status: "skipped", reason: "Old Blob no longer matches current metadata" };
    }
    // Conditional deletion: do not remove an object that has changed since HEAD.
    await del(input.previousUrl, { ifMatch: oldBlob.etag });
    console.info("Yasuragi illustration: deleted unreferenced old Blob", previous.pathname);
    return { status: "deleted", pathname: previous.pathname };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Yasuragi illustration: old Blob cleanup skipped after failed safety check", reason);
    return { status: "failed", reason: "Safety check or delete failed; previous asset preserved if possible" };
  }
}
