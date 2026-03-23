import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { YogaLibraryEntry, YogaCategory } from "@/types/activity";

const DATA_DIR = join(process.cwd(), "data", "body");
const LIBRARY_PATH = join(DATA_DIR, "yoga-library.json");

async function ensureStorage() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(LIBRARY_PATH, "utf-8");
  } catch {
    await writeFile(LIBRARY_PATH, "[]", "utf-8");
  }
}

export async function readYogaLibrary(): Promise<YogaLibraryEntry[]> {
  await ensureStorage();
  const raw = await readFile(LIBRARY_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed as YogaLibraryEntry[];
}

export async function writeYogaLibrary(entries: YogaLibraryEntry[]) {
  await ensureStorage();
  await writeFile(LIBRARY_PATH, JSON.stringify(entries, null, 2), "utf-8");
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
