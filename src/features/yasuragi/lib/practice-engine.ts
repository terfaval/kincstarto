import type {
  DecisionNode,
  DecisionOption,
  PlaybackPosition,
  PosePreview,
  PracticeCue,
  PracticeScript,
  SegmentNode,
} from "./practice-types";

const MAX_HOPS = 128; // Import allows up to 120 nodes; avoid rejecting a valid long practice.

export function allowedOptions(node: DecisionNode, poses: Record<string, PosePreview>): DecisionOption[] {
  return node.options.filter((option) => {
    if (option.availability?.startsWith("blocked")) return false;
    if (option.requiresPoseIds?.some((id) => !poses[id]?.imageUrl)) return false;
    return Boolean(poses[option.imagePoseId]?.imageUrl);
  });
}

export function chosenOption(node: DecisionNode, choices: Record<string, string>, poses: Record<string, PosePreview>): DecisionOption | null {
  const available = allowedOptions(node, poses);
  return available.find((option) => option.id === choices[node.id])
    ?? available.find((option) => option.id === node.defaultOptionId)
    ?? null;
}

/** Resolve the entire route from elapsed active time, never from a chain of timeouts. */
export function resolvePosition(
  script: PracticeScript,
  elapsedSec: number,
  choices: Record<string, string>,
  poses: Record<string, PosePreview>,
): PlaybackPosition {
  if (elapsedSec >= script.durationSec) return { node: null, localSec: 0, completed: true };
  const nodes = new Map(script.nodes.map((node) => [node.id, node]));
  let id = script.startNodeId;
  const visited = new Set<string>();
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (id === script.endNodeId) return { node: null, localSec: 0, completed: true };
    if (visited.has(id)) throw new Error(`Ciklikus gyakorlástérkép: ${id}`);
    visited.add(id);
    const node = nodes.get(id);
    if (!node) throw new Error(`Hiányzó gyakorláscsomópont: ${id}`);
    if (elapsedSec < node.startGlobalSec + node.durationSec) {
      return { node, localSec: Math.max(0, elapsedSec - node.startGlobalSec), completed: false };
    }
    if (node.type === "decision") {
      const next = chosenOption(node, choices, poses);
      if (!next) throw new Error(`Nincs elérhető útvonal: ${id}`);
      id = next.nextNodeId;
    } else {
      id = node.nextNodeId;
    }
  }
  throw new Error("Túl hosszú gyakorlástérkép");
}

export function currentCue(segment: SegmentNode, localSec: number, poseId: string): PracticeCue | null {
  const candidates = segment.cues.filter((cue) => {
    const applies = cue.appliesTo === "all_pool_poses" ||
      (Array.isArray(cue.appliesTo) && cue.appliesTo.includes(poseId)) || cue.appliesTo === poseId;
    return applies && localSec >= cue.atLocalSec && localSec < Math.min(segment.durationSec, cue.atLocalSec + cue.maxVisibleSec);
  });
  return candidates[candidates.length - 1] ?? null;
}

export type MiniText = { kind: "T" | "M" | "quiet"; text: string; cueId?: string };

/** T intro takes precedence. M windows expire instead of accumulating while a tab is hidden. */
export function selectMiniText(
  segment: SegmentNode,
  localSec: number,
  poseId: string,
  introUntilLocalSec: number,
  suppressedCueIds: ReadonlySet<string> = new Set(),
): MiniText {
  if (localSec < introUntilLocalSec) {
    return { kind: "T", text: segment.poseVariants[poseId]?.t.mini ?? "" };
  }
  const candidates = segment.cues.filter((cue) => {
    if (suppressedCueIds.has(cue.id)) return false;
    const applies = cue.appliesTo === "all_pool_poses" ||
      (Array.isArray(cue.appliesTo) && cue.appliesTo.includes(poseId)) || cue.appliesTo === poseId;
    if (!applies) return false;
    const started = Math.max(cue.atLocalSec, introUntilLocalSec);
    return started <= cue.latestStartLocalSec && localSec >= started &&
      localSec < Math.min(segment.durationSec, started + cue.maxVisibleSec);
  });
  const cue = candidates[candidates.length - 1];
  return cue ? { kind: "M", text: cue.mini, cueId: cue.id } : { kind: "quiet", text: "" };
}

/** Checks fixture topology and active branch dependencies without claiming professional approval. */
export function validatePrototypeScript(script: PracticeScript, poses: Record<string, PosePreview>): string[] {
  const errors: string[] = [];
  const nodes = new Map(script.nodes.map((node) => [node.id, node]));
  if (!nodes.has(script.startNodeId)) errors.push("Hiányzik a kezdő csomópont");
  for (const node of script.nodes) {
    if (node.durationSec <= 0) errors.push(`${node.id}: hibás hossz`);
    if (node.type === "segment") {
      if (node.availability?.startsWith("blocked")) continue;
      if (!node.posePool.includes(node.defaultPoseId)) errors.push(`${node.id}: alap póz nincs a poolban`);
      if (!poses[node.defaultPoseId]) errors.push(`${node.id}: hiányzik az alap póz a libraryből`);
      else if (!poses[node.defaultPoseId].imageUrl) errors.push(`${node.id}: az alap póznak nincs elérhető illusztrációja`);
      // Optional pool entries absent from the current library are hidden in preview.
      // The default must always exist; publication validation will be stricter.
      if (node.cues.some((cue) => cue.atLocalSec < 0 || cue.latestStartLocalSec < cue.atLocalSec || cue.latestStartLocalSec >= node.durationSec)) errors.push(`${node.id}: hibás M-ablak`);
      if (node.nextNodeId !== script.endNodeId && !nodes.has(node.nextNodeId)) errors.push(`${node.id}: hiányzó következő csomópont`);
    } else {
      const options = allowedOptions(node, poses);
      if (!options.length) errors.push(`${node.id}: nincs elérhető opció`);
      if (!options.some((option) => option.id === node.defaultOptionId)) errors.push(`${node.id}: a kötelező alapág nem elérhető`);
      for (const option of options) if (option.nextNodeId !== script.endNodeId && !nodes.has(option.nextNodeId)) errors.push(`${node.id}: hiányzó ágcél ${option.nextNodeId}`);
    }
  }
  return errors;
}
