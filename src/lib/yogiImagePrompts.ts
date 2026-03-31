import type { Anatomy, Pose, ImageSlotStatus } from "./yogiKnowledgeSchema";
import { buildAnatomyImageSpec, buildPoseImageSpec } from "./yogiImageSpecs";
import resolvePoseImageSpecFromLibrary from "./yogiPoseImageSpecLibrary";
import { compilePoseSpec } from "./yogiPosePromptCompiler";

const MANNEQUIN_STYLE_LINES = [
  "Illustrated wooden artist mannequin, no face, no facial features, simplified head, no environment",
  "Warm wood tone, soft shading, subtle shadowing, clean readable contour, not glossy, not photorealistic, not 3D render",
];

const MANNEQUIN_MAT_LINES = [
  "Flat muted purple yoga mat, solid single-tone color #957BB2, horizontally aligned",
  "Mat color must be uniform across the entire mat area with no gradients, no shading, no texture, no pattern",
  "Mat fully visible, all four mat edges visible, entire mat contained inside the image",
  "Transparent empty margin around the mat on every side, mat not cropped, no shadow",
];

const MANNEQUIN_COMPOSITION_LINES = [
  "Full body visible",
  "Full mat visible with margin around the mat",
  "Subject scaled smaller so the whole mat fits comfortably inside the canvas",
  "No body part cropped, no mat edge touching the image border",
];

const ANATOMY_SCIENTIFIC_STYLE =
  "Minimal scientific anatomical illustration focused only on the relevant region, surrounding anatomy desaturated, target structure gently highlighted with subtle realistic color, minimal Latin labels without leader lines, transparent background, not photorealistic, no arrow, no diagram, no full body.";

const FORBIDDEN_MANNEQUIN = [
  "real human",
  "photorealistic",
  "realistic lighting",
  "3d render",
  "cinematic",
  "depth of field",
  "glossy",
  "reflective",
  "realistic human anatomy",
  "realistic wood render",
  "ray tracing",
  "environment scene",
  "complex background",
  "facial expression",
  "portrait",
];

const FORBIDDEN_ANATOMY = ["full body", "whole body", "arrow", "diagram", "creepy", "horror", "gore"];

const FACE_KEYWORD_REGEXES = [
  /\bface\b/,
  /\bfacial feature(s)?\b/,
  /\bfacial detail(s)?\b/,
];
const FACE_SAFE_REGEXES = [
  /\bno face\b/,
  /\bno facial features\b/,
  /\bwithout a face\b/,
  /\bfaceless\b/,
  /\bno visible facial detail(s)?\b/,
  /\bface down\b/,
  /\bface up\b/,
  /\bface upward\b/,
  /\bface downward\b/,
];
const FACE_UNSAFE_REGEXES = [
  /\bwith a face\b/,
  /\bface visible\b/,
  /\bvisible face\b/,
  /\bfacial expression\b/,
  /\bfacial features visible\b/,
];

const FIXED_CAMERA_ALIASES = ["fixed camera", "camera fixed", "camera remains fixed", "static camera"];
const TRANSPARENT_BG_ALIASES = ["transparent background", "background transparent"];
const FULL_BODY_ALIASES = ["full body", "entire body", "whole body visible", "body fully visible"];
const FRONT_VIEW_ALIASES = [
  "strict front",
  "front view",
  "straight-on front",
  "camera facing the front of the pose",
];
const ANGLED_VIEW_ALIASES = ["3/4", "45 degrees", "three-quarter view", "angled view"];
const DEPTH_ALIASES = [
  "visible depth",
  "depth between limbs",
  "not a flat side view",
  "not flat side view",
  "clear body depth",
];

type ValidationResult = { hardErrors: string[]; warnings: string[] };

type ImageSlot = {
  spec?: string | null;
  prompt: string;
  asset_ref: string | null;
  status: ImageSlotStatus;
  warning?: string | null;
  warning_detail?: string | null;
  prompt_revision?: number | null;
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeForFaceCheck(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(prompt: string, keywords: string[]) {
  const lower = normalize(prompt);
  return keywords.some((keyword) => lower.includes(normalize(keyword)));
}

function includesForbidden(prompt: string, keywords: string[]) {
  const lower = normalize(prompt);

  return keywords.some((keyword) => {
    const k = normalize(keyword);
    if (!lower.includes(k)) return false;
    if (lower.includes(`no ${k}`)) return false;
    if (lower.includes(`not ${k}`)) return false;
    if (lower.includes(`not a ${k}`)) return false;
    if (lower.includes(`not an ${k}`)) return false;
    if (lower.includes(`do not ${k}`)) return false;
    return true;
  });
}

function hasUnsafeFaceMention(prompt: string) {
  const normalized = normalizeForFaceCheck(prompt);
  const hasSafe = FACE_SAFE_REGEXES.some((regex) => regex.test(normalized));
  const stripped = hasSafe
    ? FACE_SAFE_REGEXES.reduce((acc, regex) => acc.replace(regex, " "), normalized)
        .replace(/\s+/g, " ")
        .trim()
    : normalized;

  if (FACE_UNSAFE_REGEXES.some((regex) => regex.test(stripped))) return true;
  if (FACE_KEYWORD_REGEXES.some((regex) => regex.test(stripped))) return true;

  return false;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function cleanSpec(spec: string) {
  return spec.replace(/\s+/g, " ").trim();
}

function cleanSentence(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function splitIntoLines(value: string) {
  return value
    .split(/[.!?]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeConstraintLine(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/^do not\s+/i, "")
    .replace(/^not\s+/i, "");
}

function toDoNotLines(values?: string[] | null, limit = 4) {
  if (!values || values.length === 0) return [];
  const cleaned = values
    .map(normalizeConstraintLine)
    .filter(Boolean)
    .map((line) => `Do not ${line}`);
  return uniqueNormalizedLines(cleaned).slice(0, limit);
}

function uniqueNormalizedLines(lines: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    const key = normalize(cleaned);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function buildBlock(title: string, lines: string[]) {
  if (lines.length === 0) return "";

  const normalized = uniqueNormalizedLines(lines)
    .map((line) => cleanSentence(line))
    .filter(Boolean)
    .map((line) => `- ${line}`);

  if (normalized.length === 0) return "";

  return `${title}:\n${normalized.join("\n")}`;
}

export function buildPoseImageSlots(pose: Pose) {
  const library = resolvePoseImageSpecFromLibrary(pose);
  if (library?.spec) {
    return buildPoseImageSlotsWithSpec(
      pose,
      library.spec,
      library.compiledPrompt ?? null,
      library.visibilityConstraints ?? null,
      library.negativeConstraints ?? null,
    );
  }

  const spec = buildPoseImageSpec(pose);
  return buildPoseImageSlotsWithSpec(pose, spec);
}

export function buildPoseImageSlotsWithSpec(
  pose: Pose,
  spec: string,
  compiledPrompt?: string | null,
  visibilityConstraints?: string[] | null,
  negativeConstraints?: string[] | null,
): { mannequin_front: ImageSlot; mannequin_angled: ImageSlot } {
  const poseName = pose.name_en || pose.name_hu || pose.slug;
  const normalized = cleanSpec(spec);
  const promptSpec = compiledPrompt?.trim() ? cleanSpec(compiledPrompt) : null;

  return {
    mannequin_front: {
      spec: normalized,
      prompt: buildMannequinPrompt({
        spec: normalized,
        compiledSpecOverride: promptSpec,
        visibilityConstraints,
        negativeConstraints,
        view: "front",
        poseName,
      }),
      asset_ref: null,
      status: "missing",
      warning: null,
    },
    mannequin_angled: {
      spec: normalized,
      prompt: buildMannequinPrompt({
        spec: normalized,
        compiledSpecOverride: promptSpec,
        visibilityConstraints,
        negativeConstraints,
        view: "angled",
        poseName,
      }),
      asset_ref: null,
      status: "missing",
      warning: null,
    },
  };
}

export function buildAnatomyImageSlot(anatomy: Anatomy): ImageSlot {
  const spec = buildAnatomyImageSpec(anatomy);

  return {
    spec,
    prompt: `${ANATOMY_SCIENTIFIC_STYLE} ${spec}`.replace(/\s+/g, " ").trim(),
    asset_ref: null,
    status: "missing",
    warning: null,
  };
}

function buildMannequinPrompt({
  spec,
  compiledSpecOverride,
  visibilityConstraints,
  negativeConstraints,
  view,
  poseName,
}: {
  spec: string;
  compiledSpecOverride?: string | null;
  visibilityConstraints?: string[] | null;
  negativeConstraints?: string[] | null;
  view: "front" | "angled";
  poseName?: string | null;
}) {
  const poseIdentity = poseName || "Yoga pose";
  const isCurated = Boolean(compiledSpecOverride?.trim());

  const compiledSpec = isCurated ? compiledSpecOverride!.trim() : compilePoseSpec(spec);

  let mechanicsLines = uniqueNormalizedLines(splitIntoLines(compiledSpec));

  if (!isCurated) {
    mechanicsLines = mechanicsLines.slice(0, 4);
  }

  if (mechanicsLines.length === 0 && compiledSpec.trim()) {
    mechanicsLines.push(compiledSpec.trim());
  }

  const visibilityLines = uniqueNormalizedLines(
    (visibilityConstraints || []).map((line) => line.replace(/\s+/g, " ").trim()),
  ).filter(Boolean);

  if (visibilityLines.length > 0) {
    mechanicsLines = uniqueNormalizedLines([...mechanicsLines, ...visibilityLines]);
  }

  if (mechanicsLines.length < 2) {
    mechanicsLines.push("Anatomically coherent, physically stable pose");
  }

  const cameraLines =
    view === "front"
      ? [
          "View: strict front, camera aligned with the front edge of the mat, orthographic, no perspective distortion",
          "Fixed camera, transparent background",
          ...MANNEQUIN_COMPOSITION_LINES,
        ]
      : [
          "View: clear 3/4 (~45 degrees), camera placed on the front-facing side of the pose, visible depth between limbs, not a flat side view",
          "Fixed camera, transparent background",
          ...MANNEQUIN_COMPOSITION_LINES,
        ];

  const doNotLines = uniqueNormalizedLines([
    "Do not change the pose",
    "Do not crop the mat or any body part",
    "Do not hide critical limbs",
    "Do not alter proportions",
    ...toDoNotLines(negativeConstraints, 4),
  ]);

  const blocks = [
    buildBlock("Subject", [
      `Wooden artist mannequin performing ${poseIdentity}`,
      "This exact pose must be preserved",
    ]),
    buildBlock("Pose mechanics", mechanicsLines),
    buildBlock("Camera and composition", cameraLines),
    buildBlock("Style", MANNEQUIN_STYLE_LINES),
    buildBlock("Objects", MANNEQUIN_MAT_LINES),
    buildBlock("Do not", doNotLines),
  ].filter(Boolean);

  return ensureMannequinPrompt(blocks.join("\n\n"), view);
}

export function ensureMannequinPrompt(prompt: string, _viewType?: "front" | "angled") {
  const trimmed = prompt.trim();
  if (!trimmed) return trimmed;

  const hasStructuredBlocks = includesAny(trimmed, [
    "subject:",
    "pose mechanics:",
    "camera and composition:",
  ]);

  if (!hasStructuredBlocks) {
    return trimmed.replace(/\s+/g, " ").trim();
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedLines: string[] = [];
  let previousKey = "";

  for (const line of lines) {
    const key = normalize(line);
    if (key === previousKey) continue;
    normalizedLines.push(line);
    previousKey = key;
  }

  return normalizedLines.join("\n");
}

export function validatePoseImageSlots(slots: {
  mannequin_front?: { prompt: string };
  mannequin_angled: { prompt: string };
}): ValidationResult {
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  const front = slots.mannequin_front
    ? validateMannequinPrompt(slots.mannequin_front.prompt, "front")
    : { hardErrors: [], warnings: [] };

  const angled = validateMannequinPrompt(slots.mannequin_angled.prompt, "angled");

  hardErrors.push(...front.hardErrors, ...angled.hardErrors);
  warnings.push(...front.warnings, ...angled.warnings);

  return {
    hardErrors: unique(hardErrors),
    warnings: unique(warnings),
  };
}

const REQUIRED_MANNEQUIN_BLOCKS = [
  "subject:",
  "pose mechanics:",
  "camera and composition:",
  "style:",
  "objects:",
  "do not:",
];

function validateMannequinBlockOrder(prompt: string, hardErrors: string[]) {
  const lower = prompt.toLowerCase();
  const positions = REQUIRED_MANNEQUIN_BLOCKS.map((block) => lower.indexOf(block));

  if (positions.some((pos) => pos < 0)) {
    hardErrors.push("mannequin_missing_prompt_blocks");
    return;
  }

  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i] < positions[i - 1]) {
      hardErrors.push("mannequin_prompt_block_order_invalid");
      return;
    }
  }
}

export function validateMannequinPrompt(
  prompt: string,
  viewType?: "front" | "angled",
): ValidationResult {
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  validateMannequinBlockOrder(prompt, hardErrors);

  if (includesForbidden(prompt, FORBIDDEN_MANNEQUIN)) {
    hardErrors.push("mannequin_forbidden_style");
  }

  if (!includesAny(prompt, FIXED_CAMERA_ALIASES)) {
    hardErrors.push("mannequin_missing_fixed_camera");
  }

  if (!includesAny(prompt, TRANSPARENT_BG_ALIASES)) {
    hardErrors.push("mannequin_missing_transparent_background");
  }

  if (!includesAny(prompt, FULL_BODY_ALIASES)) {
    hardErrors.push("mannequin_missing_full_body");
  }

  if (!includesAny(prompt, ["muted purple yoga mat", "purple yoga mat"])) {
    warnings.push("mannequin_missing_mat_color");
  }

  if (viewType === "front" && !includesAny(prompt, ["orthographic"])) {
    warnings.push("mannequin_missing_orthographic_hint");
  }

  if (!includesAny(prompt, ["all four mat edges visible", "entire mat contained inside the image"])) {
    warnings.push("mannequin_missing_full_mat_constraint");
  }

  if (!includesAny(prompt, ["subject scaled smaller", "whole mat fits comfortably inside the canvas"])) {
    warnings.push("mannequin_missing_composition_scaling_constraint");
  }

  if (!includesAny(prompt, ["no mat edge touching the image border", "mat not cropped"])) {
    warnings.push("mannequin_missing_mat_border_constraint");
  }

  if (viewType === "front") {
    if (!includesAny(prompt, FRONT_VIEW_ALIASES)) {
      warnings.push("mannequin_missing_front_view");
    }
  }

  if (viewType === "angled") {
    if (!includesAny(prompt, ANGLED_VIEW_ALIASES)) {
      warnings.push("mannequin_missing_angled_view");
    }
    if (!includesAny(prompt, DEPTH_ALIASES)) {
      warnings.push("mannequin_missing_angled_depth");
    }
  }

  if (!includesAny(prompt, ["illustrated wooden artist mannequin", "illustrated wooden feel"])) {
    warnings.push("mannequin_missing_illustrated_lock");
  }

  if (hasUnsafeFaceMention(prompt)) {
    hardErrors.push("mannequin_mentions_face");
  }

  if (!includesAny(prompt, ["no face", "no facial features", "simplified head", "faceless"])) {
    warnings.push("mannequin_missing_no_face");
  }

  return {
    hardErrors: unique(hardErrors),
    warnings: unique(warnings),
  };
}

export function validateAnatomyImageSlot(slot: { prompt: string }): ValidationResult {
  const hardErrors: string[] = [];
  const warnings: string[] = [];
  const prompt = slot.prompt;

  if (includesForbidden(prompt, FORBIDDEN_ANATOMY)) {
    hardErrors.push("anatomy_prompt_forbidden_terms");
  }
  if (!includesAny(prompt, ["relevant region", "focus only on", "focus on"])) {
    hardErrors.push("anatomy_missing_region_focus");
  }
  if (!includesAny(prompt, ["highlight", "highlighted"])) {
    hardErrors.push("anatomy_missing_highlight");
  }
  if (!includesAny(prompt, ["transparent background"])) {
    hardErrors.push("anatomy_missing_transparent_background");
  }
  if (!includesAny(prompt, ["latin"])) {
    warnings.push("anatomy_missing_latin_labels");
  }
  if (!includesAny(prompt, ["desaturated", "surrounding anatomy"])) {
    warnings.push("anatomy_missing_surrounding_context");
  }

  return {
    hardErrors: unique(hardErrors),
    warnings: unique(warnings),
  };
}
