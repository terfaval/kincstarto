/**
 * Server-side, fail-closed cleanup of the image superseded by an admin upload.
 * Storage calls are injected so the safety checks can be exercised without a
 * Vercel token, and the production adapter stays in yogiOldImageCleanup.ts.
 */
export type YogiCleanupResult =
  | { status: "disabled" }
  | { status: "skipped"; reason: string }
  | { status: "deleted"; pathname: string }
  | { status: "failed"; reason: string };

type RemoteEntry = { pathname: string; url: string; etag?: string; size?: number };

type BlobClient = {
  list(options: { prefix: string; limit: number; cursor?: string }): Promise<{
    blobs: RemoteEntry[];
    hasMore: boolean;
    cursor?: string;
  }>;
  head(pathnameOrUrl: string): Promise<RemoteEntry | null>;
  get(pathname: string, options: { access: "public" }): Promise<{
    statusCode: number;
    stream?: ReadableStream<Uint8Array>;
    blob?: { etag?: string };
  } | null>;
  del(url: string, options: { ifMatch: string }): Promise<void>;
};

function normalizeEtag(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/^W\//i, "").replace(/^"|"$/g, "")
    : "";
}

function recognizedUrl(value: string): { host: string; pathname: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    const host = url.hostname.toLowerCase();
    if (!/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(host)) return null;
    const pathname = decodeURIComponent(url.pathname.slice(1));
    // Only former pose illustrations and the new admin's generated illustration assets.
    if (!/^yogi\/images\/[^/]+\/(?:mannequin_(?:angled|front|side|image)|illustration-[a-f0-9]{8})-\d+\.(?:png|webp|jpe?g)$/i.test(pathname)) return null;
    return { host, pathname };
  } catch {
    return null;
  }
}

function referencesOldImage(value: unknown, url: string, pathname: string): boolean {
  if (typeof value === "string") {
    return value.includes(url) || value.includes(encodeURIComponent(url)) || value === pathname;
  }
  if (Array.isArray(value)) return value.some((part) => referencesOldImage(part, url, pathname));
  if (value && typeof value === "object") {
    return Object.values(value).some((part) => referencesOldImage(part, url, pathname));
  }
  return false;
}

async function listAllYogiJson(blob: BlobClient): Promise<RemoteEntry[]> {
  const entries: RemoteEntry[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await blob.list({ prefix: "yogi/", limit: 1000, ...(cursor ? { cursor } : {}) });
    if (!Array.isArray(page.blobs)) throw new Error("Invalid Blob listing");
    entries.push(...page.blobs.filter((entry) => entry.pathname.endsWith(".json")));
    if (!page.hasMore) break;
    if (!page.cursor || page.cursor === cursor) throw new Error("Blob pagination did not advance");
    cursor = page.cursor;
  }
  if (!entries.some((entry) => entry.pathname === "yogi/poses.json")) {
    throw new Error("The canonical yogi/poses.json is missing");
  }
  return entries;
}

async function getConsistentPublicJson(blob: BlobClient, entry: RemoteEntry): Promise<unknown> {
  // Compare the list ETag, an origin HEAD before and after GET, and the GET ETag.
  // A CDN cache hit from a previous version must never authorize deletion.
  const expected = normalizeEtag(entry.etag);
  if (!expected || !entry.url.includes(".public.blob.vercel-storage.com/")) {
    throw new Error(`Cannot establish JSON version: ${entry.pathname}`);
  }
  const before = await blob.head(entry.pathname);
  if (!before || normalizeEtag(before.etag) !== expected || before.pathname !== entry.pathname) {
    throw new Error(`JSON changed since listing: ${entry.pathname}`);
  }
  const response = await blob.get(entry.pathname, { access: "public" });
  if (response?.statusCode !== 200 || !response.stream) {
    throw new Error(`Cannot read live JSON: ${entry.pathname}`);
  }
  const text = await new Response(response.stream).text();
  const after = await blob.head(entry.pathname);
  if (
    normalizeEtag(response.blob?.etag) !== expected ||
    !after || normalizeEtag(after.etag) !== expected || after.pathname !== entry.pathname ||
    (typeof before.size === "number" && new TextEncoder().encode(text).byteLength !== before.size)
  ) {
    throw new Error(`Live JSON is stale or changed during GET: ${entry.pathname}`);
  }
  return JSON.parse(text) as unknown;
}

export async function cleanupSupersededImage(input: {
  previousUrl: string;
  currentUrl: string;
  enabled: boolean;
  blob: BlobClient;
}): Promise<YogiCleanupResult> {
  if (!input.enabled) {
    return { status: "disabled" };
  }
  if (!input.previousUrl || input.previousUrl === input.currentUrl) {
    return { status: "skipped", reason: "No previous image to clean" };
  }
  const oldFile = recognizedUrl(input.previousUrl);
  const newFile = recognizedUrl(input.currentUrl);
  if (!oldFile || !newFile || oldFile.host !== newFile.host || oldFile.pathname === newFile.pathname) {
    return { status: "skipped", reason: "Unrecognized image URL or different Blob store" };
  }
  try {
    const docs = await listAllYogiJson(input.blob);
    for (const doc of docs) {
      const contents = await getConsistentPublicJson(input.blob, doc);
      if (referencesOldImage(contents, input.previousUrl, oldFile.pathname)) {
        return { status: "skipped", reason: `Image is still referenced in ${doc.pathname}` };
      }
    }
    const metadata = await input.blob.head(input.previousUrl);
    if (
      !metadata || metadata.url !== input.previousUrl || metadata.pathname !== oldFile.pathname ||
      !normalizeEtag(metadata.etag)
    ) {
      return { status: "skipped", reason: "Old Blob metadata has changed or is missing" };
    }
    // The SDK's conditional ifMatch prevents deletion if this object changes.
    await input.blob.del(input.previousUrl, { ifMatch: metadata.etag! });
    return { status: "deleted", pathname: oldFile.pathname };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Yasuragi: automatic old-image deletion blocked", detail);
    return { status: "failed", reason: "Safety check or Blob deletion failed; see server log" };
  }
}
