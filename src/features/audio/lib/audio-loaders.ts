import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MeditationAudioConfig, MeditationAudioMap, MeditationAudioMapItem } from "./audio-types";

const AUDIO_MAP_PATH = join(process.cwd(), "data", "audio", "meditation_audio_map.json");
const KNOWN_PREFIXES = ["pad_", "texture_", "nature_", "motion_", "accent_"];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isKnownAssetId(assetId: string) {
  return KNOWN_PREFIXES.some((prefix) => assetId.startsWith(prefix));
}

function parseAudioConfig(raw: unknown, source: string, meditationId: string): MeditationAudioConfig | null {
  if (!isObject(raw)) {
    console.warn(`[audio] Invalid audio config for ${meditationId} in ${source}.`);
    return null;
  }

  const layersRaw = raw.layers;
  if (!Array.isArray(layersRaw) || layersRaw.length === 0) {
    console.warn(`[audio] Missing layers for ${meditationId} in ${source}.`);
    return null;
  }

  if (layersRaw.length > 4) {
    console.warn(`[audio] Too many layers (${layersRaw.length}) for ${meditationId}. V1 max is 4.`);
  }

  const layers = layersRaw
    .map((layer) => {
      if (!isObject(layer)) return null;
      const assetId = typeof layer.asset_id === "string" ? layer.asset_id : "";
      if (!assetId) {
        console.warn(`[audio] Missing asset_id for ${meditationId}.`);
        return null;
      }
      if (!isKnownAssetId(assetId)) {
        console.warn(`[audio] Unknown asset prefix for ${meditationId}: ${assetId}`);
      }
      return {
        slot: typeof layer.slot === "string" ? layer.slot : undefined,
        asset_id: assetId,
        gain: typeof layer.gain === "number" ? layer.gain : undefined,
      };
    })
    .filter((layer): layer is NonNullable<typeof layer> => Boolean(layer));

  if (!layers.length) {
    console.warn(`[audio] No valid layers for ${meditationId} in ${source}.`);
    return null;
  }

  return {
    scene_profile: isObject(raw.scene_profile) ? (raw.scene_profile as MeditationAudioConfig["scene_profile"]) : undefined,
    mix: isObject(raw.mix) ? (raw.mix as MeditationAudioConfig["mix"]) : undefined,
    layers,
  };
}

export async function loadMeditationAudioMap(): Promise<MeditationAudioMap> {
  let rawText = "";
  try {
    rawText = await readFile(AUDIO_MAP_PATH, "utf-8");
  } catch (error) {
    console.warn("[audio] meditation_audio_map.json not found:", AUDIO_MAP_PATH, error);
    return { version: "0", items: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    console.warn("[audio] Invalid JSON in meditation_audio_map.json:", error);
    return { version: "0", items: {} };
  }

  if (!isObject(parsed)) {
    console.warn("[audio] meditation_audio_map.json root is not an object.");
    return { version: "0", items: {} };
  }

  const version = typeof parsed.version === "string" ? parsed.version : "0";
  if (!parsed.version) {
    console.warn("[audio] meditation_audio_map.json missing version.");
  }

  const itemsRaw = parsed.items;
  if (!isObject(itemsRaw)) {
    console.warn("[audio] meditation_audio_map.json missing items object.");
    return { version, items: {} };
  }

  const items: Record<string, MeditationAudioMapItem> = {};

  for (const [meditationId, entry] of Object.entries(itemsRaw)) {
    if (!isObject(entry) || !isObject(entry.audio)) {
      console.warn(`[audio] Missing audio entry for ${meditationId}.`);
      continue;
    }

    const audio = parseAudioConfig(entry.audio, "meditation_audio_map.json", meditationId);
    if (!audio) continue;
    items[meditationId] = { audio };
  }

  return { version, items };
}
