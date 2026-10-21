import type { CustomMeditationStage } from "./custom-meditation-types";

export type StageBoundary = {
  stageIndex: number;
  elapsedMs: number;
  cueId: CustomMeditationStage["cueId"];
  repeats: number;
};

/** Absolute (cumulative) boundaries keep the timer free of setTimeout drift. */
export function stageBoundaries(stages: readonly CustomMeditationStage[]): StageBoundary[] {
  let elapsedMs = 0;
  return stages.map((stage, stageIndex) => {
    elapsedMs += stage.durationSec * 1000;
    return { stageIndex, elapsedMs, cueId: stage.cueId, repeats: stage.repeats };
  });
}

/** Excludes the previous instant; includes the new instant, including the final cue. */
export function crossedBoundaries(
  boundaries: readonly StageBoundary[],
  previousElapsedMs: number,
  nextElapsedMs: number
): StageBoundary[] {
  if (nextElapsedMs <= previousElapsedMs) return [];
  return boundaries.filter((boundary) =>
    boundary.elapsedMs > previousElapsedMs && boundary.elapsedMs <= nextElapsedMs
  );
}
