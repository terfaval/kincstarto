/**
 * Read a specific published revision of a public Vercel Blob, bypassing stale
 * CDN entries by adding a version key derived from HEAD's ETag.
 *
 * This is only used when the regular SDK get() disagrees with HEAD. It never
 * writes data, never uses credentials in the public request, and rejects
 * unexpected hosts, paths, versions, and byte sizes.
 */
export type FreshPublicBlobMetadata = {
  pathname: string;
  url: string;
  etag: string;
  size: number;
};

export async function readFreshPublicShioriBlob(
  meta: FreshPublicBlobMetadata,
  expectedPath: string,
  request: typeof fetch = fetch,
): Promise<string> {
  if (meta.pathname !== expectedPath ||
      !/^"[^"\x00-\x20\x7f]+"$/.test(meta.etag) ||
      !Number.isSafeInteger(meta.size) || meta.size < 0) {
    throw new Error("Invalid public Blob metadata");
  }
  const url = new URL(meta.url);
  if (url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) ||
      url.pathname !== `/${expectedPath}` ||
      url.username || url.password) {
    throw new Error("Unexpected public Blob URL");
  }
  // Vercel documents a version query parameter for public Blob cache busting.
  // Using HEAD's ETag means the same revision has the same cache key.
  url.searchParams.set("v", meta.etag.slice(1, -1));
  const response = await request(url, { cache: "no-store", redirect: "error" });
  if (response.status !== 200 || response.headers.get("etag") !== meta.etag) {
    throw new Error("Public Blob revision mismatch");
  }
  const raw = await response.text();
  if (Buffer.byteLength(raw, "utf8") !== meta.size) {
    throw new Error("Public Blob byte count mismatch");
  }
  return raw;
}
