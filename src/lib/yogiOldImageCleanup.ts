import { del, get, head, list } from "@vercel/blob";
import { cleanupSupersededImage, type YogiCleanupResult } from "./yogiOldImageCleanupCore";

export type { YogiCleanupResult } from "./yogiOldImageCleanupCore";

/**
 * Called AFTER a successful illustration record update. When disabled, this
 * function does not call the Blob SDK. On errors it returns a separate status;
 * the successfully activated new image must remain active.
 */
export async function cleanupSupersededYogiImage(input: {
  previousUrl: string;
  currentUrl: string;
}): Promise<YogiCleanupResult> {
  return cleanupSupersededImage({
    ...input,
    enabled: process.env.NODE_ENV === "production" && process.env.YASURAGI_AUTO_DELETE_OLD_BLOB === "true",
    blob: {
      list: async (options) => {
        const page = await list(options);
        return { blobs: page.blobs, hasMore: page.hasMore, cursor: page.cursor };
      },
      head: async (pathnameOrUrl) => {
        const result = await head(pathnameOrUrl);
        return result ? {
          pathname: result.pathname,
          url: result.url,
          etag: result.etag,
          size: result.size,
        } : null;
      },
      get: async (pathname) => {
        const result = await get(pathname, { access: "public" });
        if (!result) return null;
        if (result.statusCode !== 200) return { statusCode: result.statusCode };
        return {
          statusCode: result.statusCode,
          stream: result.stream,
          blob: { etag: result.blob?.etag },
        };
      },
      del: (url, options) => del(url, options),
    },
  });
}
