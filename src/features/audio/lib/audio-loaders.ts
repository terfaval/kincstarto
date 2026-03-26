import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AudioLayerConfig,
  LayerEnd,
  LayerStart,
  MeditationAudioConfig,
  MeditationAudioMap,
  MeditationAudioMapItem,
} from "./audio-types";

const AUDIO_MAP_PATH = join(process.cwd(), "data", "audio", "meditation_audio_map.json");
const KNOWN_PREFIXES = ["pad_", "texture_", "nature_", "motion_", "accent_"];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isKnownAssetId(assetId: string) {
  return KNOWN_PREFIXES.some((prefix) => assetId.startsWith(prefix));
}

function isLayerSlot(value: unknown): value is AudioLayerConfig["slot"] {
  return value === "foundation" || value === "texture" || value === "nature" || value === "motion" || value === "accent";
}

function parseLayerStart(raw: unknown, meditationId: string): LayerStart | null | undefined {
  if (raw === undefined) return undefined;
  if (!isObject(raw)) {
    console.warn(`[audio] Invalid layer start for ${meditationId}.`);
    return null;
  }
  if (raw.mode !== "block_index") {
    console.warn(`[audio] Invalid layer start mode for ${meditationId}.`);
    return null;
  }
  const index = typeof raw.index === "number" ? raw.index : Number.NaN;
  if (!Number.isFinite(index) || index < 0) {
    console.warn(`[audio] Invalid layer start index for ${meditationId}.`);
    return null;
  }
  const fadeIn = typeof raw.fade_in_sec === "number" && raw.fade_in_sec >= 0 ? raw.fade_in_sec : undefined;
  return { mode: "block_index", index, fade_in_sec: fadeIn };
}

function parseLayerEnd(raw: unknown, start: LayerStart | undefined, meditationId: string): LayerEnd | null | undefined {
  if (raw === undefined) return undefined;
  if (!isObject(raw)) {
    console.warn(`[audio] Invalid layer end for ${meditationId}.`);
    return null;
  }
  if (raw.mode === "meditation_end") {
    const fadeOut = typeof raw.fade_out_sec === "number" && raw.fade_out_sec >= 0 ? raw.fade_out_sec : undefined;
    return { mode: "meditation_end", fade_out_sec: fadeOut };
  }
  if (raw.mode !== "block_index") {
    console.warn(`[audio] Invalid layer end mode for ${meditationId}.`);
    return null;
  }
  const index = typeof raw.index === "number" ? raw.index : Number.NaN;
  if (!Number.isFinite(index) || index < 0) {
    console.warn(`[audio] Invalid layer end index for ${meditationId}.`);
    return null;
  }
  if (start && index < start.index) {
    console.warn(`[audio] Layer end index precedes start index for ${meditationId}.`);
    return null;
  }
  const fadeOut = typeof raw.fade_out_sec === "number" && raw.fade_out_sec >= 0 ? raw.fade_out_sec : undefined;
  return { mode: "block_index", index, fade_out_sec: fadeOut };
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
      const start = parseLayerStart(layer.start, meditationId);
      if (start === null) return null;
      const end = parseLayerEnd(layer.end, start ?? undefined, meditationId);
      if (end === null) return null;
      const gain = typeof layer.gain === "number" ? layer.gain : 0.2;
      const slot: AudioLayerConfig["slot"] = isLayerSlot(layer.slot) ? layer.slot : "texture";
      return {
        slot,
        asset_id: assetId,
        gain,
        start,
        end,
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
