import { put, type BlobAccessType } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isBlobEnabled } from "./jsonStore";

const DEFAULT_ACCESS: BlobAccessType = "public";
const LOCAL_DIR = join(process.cwd(), "public", "yogi-images");

type SaveImageOptions = {
  slug: string;
  slot: string;
  format: "png" | "webp" | "jpeg";
  buffer: Buffer;
};

function buildFileName(slug: string, slot: string, format: string) {
  const safeSlug = slug && slug.trim().length > 0 ? slug : "unknown";
  const ts = Date.now();
  return `${safeSlug}/${slot}-${ts}.${format}`;
}

export async function saveYogiImageAsset(options: SaveImageOptions) {
  const { slug, slot, format, buffer } = options;
  const fileName = buildFileName(slug, slot, format);
  const safeSlug = slug && slug.trim().length > 0 ? slug : "unknown";
  const contentType =
    format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";

  if (isBlobEnabled()) {
    const blobPath = `yogi/images/${fileName}`;
    const result = await put(blobPath, buffer, {
      access: DEFAULT_ACCESS,
      contentType,
      allowOverwrite: true,
    });
    return { url: result.url, blobPath };
  }

  const localPath = join(LOCAL_DIR, fileName);
  await mkdir(join(LOCAL_DIR, safeSlug), { recursive: true });
  await writeFile(localPath, buffer);
  return { url: `/yogi-images/${fileName}`, blobPath: null };
}
