import type { PosePreview } from "./practice-types";

/** Public releases may never depend on the admin-only image proxy. */
export function publicPoseImageUrl(source: string): string | null {
  if (source.startsWith("/yogi-images/") && !source.includes("..") && !/[?#\\]/.test(source)) return source;
  if (!source.startsWith("/api/yogi-knowledge/image-proxy?")) return null;
  try {
    const wrapper = new URL(source, "https://example.invalid");
    if (wrapper.pathname !== "/api/yogi-knowledge/image-proxy") return null;
    const raw = wrapper.searchParams.get("url");
    if (!raw) return null;
    const original = new URL(raw);
    const hostname = original.hostname.toLowerCase();
    if (original.protocol !== "https:" || original.username || original.password || original.port ||
        !(hostname === "public.blob.vercel-storage.com" || hostname === "vercel-storage.com" || hostname.endsWith(".public.blob.vercel-storage.com"))) return null;
    return original.toString();
  } catch { return null; }
}

export function preparePublicPosePreviews(
  poses: Record<string, PosePreview>, requiredPoseIds: readonly string[],
): Record<string, PosePreview> {
  const result: Record<string, PosePreview> = {};
  for (const id of requiredPoseIds) {
    const pose = poses[id];
    if (!pose || pose.id !== id) throw new Error(`Hiányzó publikálható póz: ${id}`);
    const imageUrl = publicPoseImageUrl(pose.imageUrl);
    if (!imageUrl) throw new Error(`Nincs nyilvánosan elérhető illusztráció: ${id}`);
    Object.defineProperty(result, id, { configurable: true, enumerable: true, writable: true, value: { ...pose, imageUrl } });
  }
  return result;
}
