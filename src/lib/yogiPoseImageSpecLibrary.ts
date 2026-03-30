import poseSpecsRaw from "../../data/yogi/pose-image-specs.v1.json";

type PoseSpecBody = {
  head_neck_gaze: string;
  arms_shoulders_hands: string;
  chest_spine: string;
  pelvis_hips: string;
  front_leg: string;
  back_leg: string;
  base_weight: string;
  pose_axis: string;
};

type PoseSpecVariation = {
  id: string;
  match_tokens?: string[];
  body: PoseSpecBody;
  critical_relations?: string[];
  visibility_constraints?: string[];
  negative_constraints?: string[];
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

function findPoseEntry(pose: PoseInput): PoseSpecEntry | undefined {
  const slug = normalize(pose.slug);
  const nameRaw = `${pose.name_en || ""} ${pose.name_hu || ""}`.trim();
  const name = normalize(nameRaw);
  const nameTokens = tokenize(nameRaw);

  return poseSpecs.poses.find((p) => {
    const displayName = p.display_name || "";
    const slugName = p.slug?.replace(/[_-]+/g, " ");

    if (slug && equalsNormalized(slug, p.slug)) return true;
    if (slug && p.aliases?.some((a) => equalsNormalized(slug, a))) return true;

    if (name) {
      if (equalsNormalized(name, displayName)) return true;
      if (p.aliases?.some((a) => equalsNormalized(name, a))) return true;
      if (slugName && equalsNormalized(name, slugName)) return true;
    }

    if (nameTokens.length > 0) {
      const displayTokens = tokenize(displayName);
      if (containsTokenSequence(nameTokens, displayTokens)) return true;
      if (p.aliases?.some((a) => containsTokenSequence(nameTokens, tokenize(a)))) return true;
      if (slugName && containsTokenSequence(nameTokens, tokenize(slugName))) return true;
    }

    return false;
  });
}

function selectVariation(entry: PoseSpecEntry, pose: PoseInput): PoseSpecVariation | null {
  const text = normalize(
    `${pose.setup || ""} ${pose.entry || ""} ${pose.hold || ""}`
  );

  if (!entry.variations || entry.variations.length === 0) return null;

  for (const v of entry.variations) {
    if (v.match_tokens?.some((t: string) => text.includes(normalize(t)))) {
      return v;
    }
  }

  return entry.variations.find((v) => v.id === entry.default_variation) || entry.variations[0];
}

function ensureSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function buildSpecString(entry: PoseSpecEntry, variation: PoseSpecVariation) {
  const parts: string[] = [];

  const identity = `Pose identity: ${entry.display_name}. Do not substitute with a different pose.`;
  const identitySentence = ensureSentence(identity);
  if (identitySentence) parts.push(identitySentence);

  const body = variation.body;

  const bodyLines = [
    `Head/Neck/Gaze ${body.head_neck_gaze}`,
    `Arms/Shoulders/Hands ${body.arms_shoulders_hands}`,
    `Chest/Spine ${body.chest_spine}`,
    `Pelvis/Hips ${body.pelvis_hips}`,
    `Front Leg ${body.front_leg}`,
    `Back Leg ${body.back_leg}`,
    `Base/Weight ${body.base_weight}`,
    `Pose Axis ${body.pose_axis}`,
  ];

  bodyLines.forEach((line) => {
    const next = ensureSentence(line);
    if (next) parts.push(next);
  });

  variation.critical_relations?.slice(0, 2).forEach((r: string, i: number) => {
    const next = ensureSentence(`Critical Relation ${i + 1} ${r}`);
    if (next) parts.push(next);
  });

  variation.visibility_constraints?.slice(0, 1).forEach((v: string) => {
    const next = ensureSentence(`Visibility Constraint ${v}`);
    if (next) parts.push(next);
  });

  variation.negative_constraints?.slice(0, 2).forEach((n: string) => {
    const next = ensureSentence(`Negative Constraint ${n}`);
    if (next) parts.push(next);
  });

  return parts.join(" ");
}

export function resolvePoseImageSpecFromLibrary(pose: PoseInput): ResolvedSpec {
  const entry = findPoseEntry(pose);
  if (!entry) return { spec: null, source: "none" };

  const variation = selectVariation(entry, pose);
  if (!variation) return { spec: null, source: "none" };

  const spec = buildSpecString(entry, variation);

  return {
    spec,
    source: "library",
    poseId: entry.id,
    variationId: variation.id,
  };
}

export default resolvePoseImageSpecFromLibrary;
