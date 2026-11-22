import type { PosePreview } from "./practice-types";

/**
 * Next.js Server -> Client Components require a normal object prototype.
 * Keep the server-built null-prototype lookup for safe indexing; only convert
 * the final, read-only preview map at the React Server Components boundary.
 * Object.fromEntries retains even unusual own keys as data properties.
 */
export function toClientPosePreviews(previews: Readonly<Record<string, PosePreview>>): Record<string, PosePreview> {
  return Object.fromEntries(Object.entries(previews));
}
