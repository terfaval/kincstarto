import { join } from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/jsonStore";
import type { YogaVideoMeta } from "@/lib/yogaVideoMetaSchema";

const DATA_DIR = join(process.cwd(), "data", "yogi");
const META_PATH = join(DATA_DIR, "yoga-video-metadata.json");
const META_BLOB_PATH = "yogi/yoga-video-metadata.json";

export async function readYogaVideoMeta(): Promise<YogaVideoMeta[]> {
  const parsed = await readJsonStore<YogaVideoMeta[]>({
    blobPath: META_BLOB_PATH,
    filePath: META_PATH,
    fallbackValue: [],
  });
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeYogaVideoMeta(entries: YogaVideoMeta[]) {
  await writeJsonStore(
    {
      blobPath: META_BLOB_PATH,
      filePath: META_PATH,
    },
    entries
  );
}
