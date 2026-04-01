import { join } from "node:path";
import type { YogaLibraryEntry, YogaCategory } from "@/types/activity";
import { readJsonStore, writeJsonStore } from "@/lib/jsonStore";

const DATA_DIR = join(process.cwd(), "data", "body");
const LIBRARY_PATH = join(DATA_DIR, "yoga-library.json");
const LIBRARY_BLOB_PATH = "body/yoga-library.json";

export async function readYogaLibrary(): Promise<YogaLibraryEntry[]> {
  const parsed = await readJsonStore<YogaLibraryEntry[]>({
    blobPath: LIBRARY_BLOB_PATH,
    filePath: LIBRARY_PATH,
    fallbackValue: [],
    seedIfMissing: false,
    createIfMissing: false,
  });
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeYogaLibrary(entries: YogaLibraryEntry[]) {
  await writeJsonStore(
    {
      blobPath: LIBRARY_BLOB_PATH,
      filePath: LIBRARY_PATH,
    },
    entries
  );
}

export function createYogaId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `yoga_${stamp}_${rand}`;
}

export function yogaEntryKey(entry: {
  link: string | null;
  label: string;
  category: YogaCategory;
  duration_minutes: number | null;
  intensity: number | null;
}) {
  if (entry.link) return `link:${entry.link.trim()}`;
  return `meta:${entry.category}|${entry.label}|${entry.duration_minutes ?? ""}|${entry.intensity ?? ""}`;
}

export function findYogaEntry(
  library: YogaLibraryEntry[],
  entry: {
    link: string | null;
    label: string;
    category: YogaCategory;
    duration_minutes: number | null;
    intensity: number | null;
  }
) {
  const key = yogaEntryKey(entry);
  return library.find((item) => yogaEntryKey(item) === key);
}
