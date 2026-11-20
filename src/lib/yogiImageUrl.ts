/** Resolve image assets stored in Vercel Blob or the local development public folder. */
export function resolveYogiImageUrl(reference?: string | null) {
  if (!reference) return "";
  if (reference.startsWith("/yogi-images/") && !reference.includes("..")) {
    return reference;
  }
  if (!reference.startsWith("https://")) return "";
  try {
    const parsed = new URL(reference);
    const host = parsed.hostname.toLowerCase();
    if (
      host !== "public.blob.vercel-storage.com" &&
      host !== "vercel-storage.com" &&
      !host.endsWith(".public.blob.vercel-storage.com")
    ) {
      return "";
    }
    return `/api/yogi-knowledge/image-proxy?url=${encodeURIComponent(reference)}`;
  } catch {
    return "";
  }
}
