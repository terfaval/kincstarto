import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Meditation, MeditationCategory, MeditationLevel, MeditationStatus } from "./meditation-types";

const MEDITATIONS_DIR = join(process.cwd(), "data", "meditations");

const CATEGORY_SET = new Set<MeditationCategory>(["ALV", "STR", "FOK", "ENR", "SPC"]);
const LEVEL_SET = new Set<MeditationLevel>(["kezdo", "kozep-halado", "halado"]);
const STATUS_SET = new Set<MeditationStatus>(["raw", "optimalizalt"]);
const END_BEHAVIOR_SET = new Set(["fade_out", "soft_end", "complete"] as const);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseMeditation(raw: unknown, source: string): Meditation | null {
  if (!isObject(raw)) {
    console.error(`[meditations] Invalid JSON in ${source}: not an object.`);
    return null;
  }

  const category = raw.category as MeditationCategory;
  const level = raw.level as MeditationLevel;
  const status = raw.status as MeditationStatus;

  if (!CATEGORY_SET.has(category)) {
    console.error(`[meditations] Invalid category in ${source}.`);
    return null;
  }
  if (!LEVEL_SET.has(level)) {
    console.error(`[meditations] Invalid level in ${source}.`);
    return null;
  }
  if (!STATUS_SET.has(status)) {
    console.error(`[meditations] Invalid status in ${source}.`);
    return null;
  }

  if (!isObject(raw.reader) || !Array.isArray(raw.reader.blocks)) {
    console.error(`[meditations] Missing reader blocks in ${source}.`);
    return null;
  }

  const endBehavior = raw.reader.end_behavior as Meditation["reader"]["end_behavior"];
  if (!END_BEHAVIOR_SET.has(endBehavior)) {
    console.error(`[meditations] Invalid end behavior in ${source}.`);
    return null;
  }
  const meditation: Meditation = {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    category,
    level,
    order_in_category: Number(raw.order_in_category ?? 0),
    duration_sec: Number(raw.duration_sec ?? 0),
    summary_short: String(raw.summary_short ?? ""),
    tone: Array.isArray(raw.tone) ? raw.tone.map(String) : [],
    techniques: Array.isArray(raw.techniques) ? raw.techniques.map(String) : [],
    visual_theme: String(raw.visual_theme ?? "default"),
    status,
    is_published: Boolean(raw.is_published),
    campaign_key: raw.campaign_key === null ? null : String(raw.campaign_key ?? ""),
    source_docx: String(raw.source_docx ?? ""),
    reader: {
      autoplay: true,
      end_behavior: endBehavior,
      blocks: raw.reader.blocks as Meditation["reader"]["blocks"],
    },
  };

  if (!meditation.id || !meditation.title) {
    console.error(`[meditations] Missing id/title in ${source}.`);
    return null;
  }

  return meditation;
}

export async function loadMeditations(): Promise<Meditation[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(MEDITATIONS_DIR);
  } catch (error) {
    console.error("[meditations] Directory not found:", MEDITATIONS_DIR, error);
    return [];
  }

  const meditations: Meditation[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const path = join(MEDITATIONS_DIR, entry);
    try {
      const raw = await readFile(path, "utf-8");
      const parsed = JSON.parse(raw);
      const meditation = parseMeditation(parsed, entry);
      if (meditation && meditation.is_published) meditations.push(meditation);
    } catch (error) {
      console.error(`[meditations] Failed to read ${entry}:`, error);
    }
  }

  return meditations.sort((a, b) => {
    if (a.category === b.category) {
      return a.order_in_category - b.order_in_category;
    }
    return a.category.localeCompare(b.category);
  });
}
