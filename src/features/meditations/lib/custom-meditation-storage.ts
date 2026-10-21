import {
  CUSTOM_CUES,
  MAX_PRESETS,
  MAX_REPEATS,
  MAX_STAGE_SECONDS,
  MAX_STAGES,
  MIN_STAGE_SECONDS,
  type CustomCueId,
  type CustomMeditationCollection,
  type CustomMeditationDraft,
  type CustomMeditationPreset,
  type CustomMeditationStage,
} from "./custom-meditation-types";

export const CUSTOM_MEDITATIONS_STORAGE_KEY = "kincstarto.customMeditations.v1";

export const EMPTY_CUSTOM_MEDITATIONS: CustomMeditationCollection = {
  version: 1,
  defaultId: null,
  presets: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Older localStorage presets used guided-reader accent IDs. Map those on read,
 * never fetch accent files from the custom player or destroy the saved presets. */
const LEGACY_CUE_MAP: Readonly<Record<string, CustomCueId>> = {
  accent_chime_soft_02: "bells",
  accent_resonance_airy_01: "singing-bowl-hit",
};

function resolveStoredCue(value: unknown): CustomCueId | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const current = CUSTOM_CUES.find((cue) => cue.id === value);
  return current ? current.id : LEGACY_CUE_MAP[value];
}

function parseStage(raw: unknown): CustomMeditationStage | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id || raw.id.length > 120) return null;
  if (typeof raw.title !== "string" || !raw.title.trim() || raw.title.trim().length > 60) return null;
  if (!Number.isInteger(raw.durationSec) || (raw.durationSec as number) < MIN_STAGE_SECONDS ||
      (raw.durationSec as number) > MAX_STAGE_SECONDS) return null;
  const cueId = resolveStoredCue(raw.cueId);
  if (cueId === undefined) return null;
  if (!Number.isInteger(raw.repeats) || (raw.repeats as number) < 1 || (raw.repeats as number) > MAX_REPEATS) return null;
  return {
    id: raw.id,
    title: raw.title.trim(),
    durationSec: raw.durationSec as number,
    cueId,
    repeats: cueId === null ? 1 : (raw.repeats as number),
  };
}

function parsePreset(raw: unknown): CustomMeditationPreset | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id || raw.id.length > 120 ||
      typeof raw.title !== "string" || !raw.title.trim() || raw.title.trim().length > 70 ||
      !Array.isArray(raw.stages) || raw.stages.length < 1 || raw.stages.length > MAX_STAGES) return null;
  const stages = raw.stages.map(parseStage);
  if (stages.some((stage) => !stage)) return null;
  const ids = (stages as CustomMeditationStage[]).map((stage) => stage.id);
  if (new Set(ids).size !== ids.length) return null;
  return { id: raw.id, title: raw.title.trim(), stages: stages as CustomMeditationStage[] };
}

export function parseCustomMeditations(raw: unknown): CustomMeditationCollection | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.presets) || raw.presets.length > MAX_PRESETS) {
    return null;
  }
  const presets = raw.presets.map(parsePreset);
  if (presets.some((preset) => !preset)) return null;
  const accepted = presets as CustomMeditationPreset[];
  if (new Set(accepted.map((preset) => preset.id)).size !== accepted.length) return null;
  const requestedDefault = typeof raw.defaultId === "string" ? raw.defaultId : null;
  const defaultId = accepted.some((preset) => preset.id === requestedDefault)
    ? requestedDefault
    : (accepted[0]?.id ?? null);
  return { version: 1, presets: accepted, defaultId };
}

/** Reject corrupt/out-of-range drafts before writing them to persistent storage. */
export function validateCustomMeditationDraft(draft: CustomMeditationDraft): CustomMeditationDraft | null {
  const parsed = parsePreset({ ...draft, id: "validation" });
  return parsed ? { title: parsed.title, stages: parsed.stages } : null;
}

export function loadCustomMeditations(): CustomMeditationCollection {
  const raw = window.localStorage.getItem(CUSTOM_MEDITATIONS_STORAGE_KEY);
  if (raw === null) return EMPTY_CUSTOM_MEDITATIONS;
  try {
    const parsed = parseCustomMeditations(JSON.parse(raw));
    if (!parsed) throw new Error("Invalid custom meditation storage schema");
    return parsed;
  } catch {
    throw new Error("A korábban mentett gyakorlások adatai nem olvashatók. Az adatok nem lettek felülírva.");
  }
}

export function storeCustomMeditations(value: CustomMeditationCollection): void {
  const validated = parseCustomMeditations(value);
  if (!validated) throw new Error("Érvénytelen meditációs beállítás.");
  window.localStorage.setItem(CUSTOM_MEDITATIONS_STORAGE_KEY, JSON.stringify(validated));
}
