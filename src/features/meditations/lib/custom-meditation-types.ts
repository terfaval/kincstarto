/** The custom timer is intentionally separate from guided meditation/reader data. */
/** One reserved opening sound, never selectable as a stage cue. */
export const CUSTOM_OPENING_PATH = "/audio/timer/opening-signature.mp3";

/** All stage cues are served from the dedicated meditation timer folder. */
export const CUSTOM_CUES = [
  { id: "bells", label: "Csengők", path: "/audio/timer/bells.mp3" },
  { id: "cymbal", label: "Cintányér", path: "/audio/timer/cymbal.mp3" },
  { id: "windchime", label: "Szélcsengő", path: "/audio/timer/windchime.mp3" },
  { id: "singing-bowl-hit", label: "Hangtál", path: "/audio/timer/singing-bowl-hit.mp3" },
  { id: "bell-hit-crown-chakra", label: "Koronacsakra-harang", path: "/audio/timer/bell-hit-crown-chakra.mp3" },
  { id: "bell-hit-root-chakra", label: "Gyökércsakra-harang", path: "/audio/timer/bell-hit-root-chakra.mp3" },
] as const;

export type CustomCueId = (typeof CUSTOM_CUES)[number]["id"];

export function getCustomCuePath(id: CustomCueId): string {
  const cue = CUSTOM_CUES.find((item) => item.id === id);
  if (!cue) throw new Error(`Unknown custom meditation cue: ${id}`);
  return cue.path;
}

export type CustomMeditationStage = {
  id: string;
  title: string;
  durationSec: number;
  /** A null cue means that a stage ends silently. */
  cueId: CustomCueId | null;
  repeats: number;
};

export type CustomMeditationPreset = {
  id: string;
  title: string;
  stages: CustomMeditationStage[];
};

export type CustomMeditationDraft = Pick<CustomMeditationPreset, "title" | "stages">;

export type CustomMeditationCollection = {
  version: 1;
  defaultId: string | null;
  presets: CustomMeditationPreset[];
};


export const MIN_STAGE_SECONDS = 15;
export const MAX_STAGE_SECONDS = 2 * 60 * 60;
export const MAX_STAGES = 20;
export const MAX_PRESETS = 50;
export const MAX_REPEATS = 8;

export const durationOfPreset = (preset: CustomMeditationDraft): number =>
  preset.stages.reduce((sum, stage) => sum + stage.durationSec, 0);

export const formatCustomDuration = (durationSec: number): string => {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  if (!minutes) return `${seconds} mp`;
  return seconds ? `${minutes} perc ${seconds} mp` : `${minutes} perc`;
};

export function newCustomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function newCustomStage(number: number): CustomMeditationStage {
  return {
    id: newCustomId(),
    title: `Szakasz ${number}`,
    durationSec: 300,
    cueId: null,
    repeats: 1,
  };
}
