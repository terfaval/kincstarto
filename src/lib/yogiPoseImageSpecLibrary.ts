import poseSpecsRaw from "../../data/yogi/pose-image-specs.v1.json";
import { compilePoseSpecFromLines } from "./yogiPosePromptCompiler";

type PoseSpecVariation = {
  id: string;
  match_tokens?: string[];
  pose_identity?: string;
  prompt_override?: string;
  pose_mechanics: string[];
  critical_relations?: string[];
  visibility_constraints?: string[];
  negative_constraints?: string[];
  view_hints?: {
    front?: string;
    angled?: string;
  };
  side_topology?: {
    left_leg_role?: "front_leg" | "back_leg" | "support_leg" | "lifted_leg" | "neutral";
    right_leg_role?: "front_leg" | "back_leg" | "support_leg" | "lifted_leg" | "neutral";
    left_arm_role?: "support_arm" | "reaching_arm" | "neutral";
    right_arm_role?: "support_arm" | "reaching_arm" | "neutral";
    foreground_side?: "left" | "right" | "none";
  };
};

type PoseSpecEntry = {
  id: string;
  slug: string;
  aliases?: string[];
  display_name: string;
  symmetry?: string;
  mirrorable?: boolean;
  default_variation?: string;
  view_hints?: {
    front?: string;
    angled?: string;
  };
  variations?: PoseSpecVariation[];
};

type PoseSpecLibrary = {
  version: number;
  poses: PoseSpecEntry[];
};

const poseSpecs = poseSpecsRaw as PoseSpecLibrary;

type PoseInput = {
  slug?: string;
  name_en?: string;
  name_hu?: string;
  setup?: string;
  entry?: string;
  hold?: string;
};

type ResolvedSpec = {
  spec: string | null;
  source: "library" | "none";
  poseId?: string;
  variationId?: string;
  compiledPrompt?: string | null;
  visibilityConstraints?: string[] | null;
  negativeConstraints?: string[] | null;
};

function normalize(value?: string) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function equalsNormalized(a?: string, b?: string) {
  if (!a || !b) return false;
  return normalize(a) === normalize(b);
}

function tokenize(value?: string) {
  const normalized = normalize(value);
  if (!normalized) return [];
  return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

function containsTokenSequence(tokens: string[], phraseTokens: string[]) {
  if (phraseTokens.length === 0 || tokens.length < phraseTokens.length) return false;

  for (let i = 0; i <= tokens.length - phraseTokens.length; i += 1) {
    let match = true;
    for (let j = 0; j < phraseTokens.length; j += 1) {
      if (tokens[i + j] !== phraseTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  return false;
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    const key = normalize(cleaned);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function hasAllTokens(haystackTokens: string[], needleTokens: string[]) {
  if (needleTokens.length === 0) return false;
  const haystackSet = new Set(haystackTokens);
  return needleTokens.every((token) => haystackSet.has(token));
}

function buildNameCandidates(pose: PoseInput) {
  return uniqueNormalized([
    pose.slug || "",
    pose.name_en || "",
    pose.name_hu || "",
    `${pose.name_en || ""} ${pose.name_hu || ""}`.trim(),
  ]);
}

function findPoseEntry(pose: PoseInput): PoseSpecEntry | undefined {
  const slug = normalize(pose.slug);
  const nameCandidates = buildNameCandidates(pose);
  const allCandidateTokens = uniqueNormalized(nameCandidates).flatMap((candidate) => tokenize(candidate));

  return poseSpecs.poses.find((p) => {
    const displayName = p.display_name || "";
    const slugName = p.slug?.replace(/[_-]+/g, " ") || "";
    const aliases = p.aliases || [];

    const directNames = [p.slug, displayName, slugName, ...aliases];

    if (slug && directNames.some((candidate) => equalsNormalized(slug, candidate))) {
      return true;
    }

    if (
      nameCandidates.some((candidate) =>
        directNames.some((target) => equalsNormalized(candidate, target))
      )
    ) {
      return true;
    }

    const targetTokenGroups = uniqueNormalized([displayName, slugName, ...aliases]).map((value) =>
      tokenize(value)
    );

    if (
      targetTokenGroups.some((tokens) =>
        nameCandidates.some((candidate) => containsTokenSequence(tokenize(candidate), tokens))
      )
    ) {
      return true;
    }

    if (
      targetTokenGroups.some((tokens) => hasAllTokens(allCandidateTokens, tokens))
    ) {
      return true;
    }

    return false;
  });
}

function selectVariation(entry: PoseSpecEntry, pose: PoseInput): PoseSpecVariation | null {
  const text = normalize(`${pose.setup || ""} ${pose.entry || ""} ${pose.hold || ""}`);

  if (!entry.variations || entry.variations.length === 0) return null;

  if (text) {
    for (const variation of entry.variations) {
      if (variation.match_tokens?.some((token) => text.includes(normalize(token)))) {
        return variation;
      }
    }
  }

  return entry.variations.find((variation) => variation.id === entry.default_variation) || entry.variations[0];
}

function ensureSentence(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function pushSentence(parts: string[], value?: string | null) {
  const next = ensureSentence(value || "");
  if (next) parts.push(next);
}

function buildSpecString(entry: PoseSpecEntry, variation: PoseSpecVariation) {
  const parts: string[] = [];

  const identity = variation.pose_identity || entry.display_name;
  pushSentence(parts, `Pose identity: ${identity}. Do not substitute with a different pose.`);

  (variation.pose_mechanics || [])
    .forEach((line) => pushSentence(parts, line));

  (variation.critical_relations || [])
    .slice(0, 2)
    .forEach((relation, index) => pushSentence(parts, `Critical Relation ${index + 1} ${relation}`));

  (variation.visibility_constraints || [])
    .slice(0, 1)
    .forEach((constraint) => pushSentence(parts, `Visibility Constraint ${constraint}`));

  return parts.join(" ");
}

export function resolvePoseImageSpecFromLibrary(pose: PoseInput): ResolvedSpec {
  const entry = findPoseEntry(pose);
  if (!entry) {
    return {
      spec: null,
      source: "none",
      compiledPrompt: null,
      visibilityConstraints: null,
      negativeConstraints: null,
    };
  }

  const variation = selectVariation(entry, pose);
  if (!variation) {
    return {
      spec: null,
      source: "none",
      compiledPrompt: null,
      visibilityConstraints: null,
      negativeConstraints: null,
    };
  }

  const spec = buildSpecString(entry, variation);
  // compiledPrompt is the primary runtime prompt input; spec is a secondary debug/fallback artifact.
  const compiledPrompt =
    variation.prompt_override?.trim() || compilePoseSpecFromLines(variation.pose_mechanics);

  return {
    spec,
    source: "library",
    poseId: entry.id,
    variationId: variation.id,
    compiledPrompt,
    visibilityConstraints: variation.visibility_constraints ?? null,
    negativeConstraints: variation.negative_constraints ?? null,
  };
}

export default resolvePoseImageSpecFromLibrary;
