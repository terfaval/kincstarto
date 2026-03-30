import type { Anatomy, Pose, ImageSlotStatus } from "./yogiKnowledgeSchema";
import { buildAnatomyImageSpec, buildPoseImageSpec } from "./yogiImageSpecs";
import { compilePoseSpec } from "./yogiPosePromptCompiler";

const MANNEQUIN_STYLE_CORE =
  "Style lock: illustrated wooden feel, warm wood tone, soft shading, subtle shadowing, clean readable contour, not glossy, not photorealistic, not 3D render.";

const MANNEQUIN_MAT_BLOCK =
  "Mat: flat muted purple yoga mat, horizontally aligned, fully visible, all four mat edges visible, entire mat contained inside the image, transparent empty margin around the mat on every side, mat not cropped, no shadow, no texture.";

const MANNEQUIN_COMPOSITION_BLOCK =
  "Composition: full body and full mat both entirely visible inside the frame, subject scaled smaller so the whole mat fits comfortably inside the canvas, no body part cropped, no mat edge touching the image border, clear empty transparent margin around the entire mat.";

const MANNEQUIN_COMMON_BLOCK =
  "Mannequin: illustrated wooden artist mannequin, no face, no facial features, simplified head, fixed camera, full body visible, transparent background, no environment.";

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
    return true;
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function cleanSpec(spec: string) {
  return spec.replace(/\s+/g, " ").trim();
}

export function buildPoseImageSlots(pose: Pose) {
  const spec = buildPoseImageSpec(pose);
  return buildPoseImageSlotsWithSpec(pose, spec);
}

export function buildPoseImageSlotsWithSpec(
  pose: Pose,
  spec: string
): { mannequin_front: ImageSlot; mannequin_angled: ImageSlot } {
  const poseName = pose.name_en || pose.name_hu || pose.slug;
  const normalized = cleanSpec(spec);

  return {
    mannequin_front: {
      spec: normalized,
      prompt: buildMannequinPrompt({ spec: normalized, view: "front", poseName, pose }),
      asset_ref: null,
      status: "missing",
      warning: null,
    },
    mannequin_angled: {
      spec: normalized,
      prompt: buildMannequinPrompt({ spec: normalized, view: "angled", poseName, pose }),
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
  view,
  poseName,
  pose,
}: {
  spec: string;
  view: "front" | "angled";
  poseName?: string | null;
  pose: Pose;
}) {
  const compiledSpec = compilePoseSpec(spec);
  const specBlock = `Pose: ${compiledSpec}`;
  const specHasIdentity = spec.trim().toLowerCase().startsWith("pose identity:");
  const poseBlock = specHasIdentity
    ? ""
    : poseName
      ? `Pose identity: ${poseName}. Do not substitute with a different pose.`
      : "Pose identity must be preserved. Do not substitute with a different pose.";

  const viewBlock =
    view === "front"
      ? "View: strict front, camera aligned with the front edge of the mat, body facing the mat front, orthographic feel, no perspective distortion, no dramatic perspective."
      : "View: clear 3/4 (~45 degrees), camera placed on the front-facing side of the pose, body oriented toward the viewer side, main direction of the pose clearly visible, visible depth between left and right limbs, not flat side view, no dramatic perspective.";

  const clarityBlock =
    view === "front"
      ? "Show the pose clearly from the front with stable anatomical coherence and readable body-part separation."
      : "Show the pose clearly in angled view with readable body depth, stable anatomical coherence, and readable body-part separation.";

  
  return ensureMannequinPrompt(
    [
      poseBlock,
      specBlock,
      viewBlock,
      clarityBlock,
      MANNEQUIN_COMMON_BLOCK,
      MANNEQUIN_STYLE_CORE,
      MANNEQUIN_MAT_BLOCK,
      MANNEQUIN_COMPOSITION_BLOCK,
    ]
      .filter(Boolean)
      .join(" "),
    view,
  );
}

export function ensureMannequinPrompt(prompt: string, viewType?: "front" | "angled") {
  let next = prompt.trim();
  const lower = normalize(next);

  if (!lower.includes("mannequin:")) {
    next = `${next} ${MANNEQUIN_COMMON_BLOCK}`;
  }

  if (!lower.includes("mat:")) {
    next = `${next} ${MANNEQUIN_MAT_BLOCK}`;
  }

  if (!lower.includes("style lock:")) {
    next = `${next} ${MANNEQUIN_STYLE_CORE}`;
  }

  if (!lower.includes("composition:")) {
    next = `${next} ${MANNEQUIN_COMPOSITION_BLOCK}`;
  }

  if (viewType === "front" && !includesAny(next, ["strict front", "front-facing", "body facing the mat front"])) {
    next = `${next} Strict front view.`;
  }

  if (viewType === "angled" && !includesAny(next, ["3/4", "45 degrees", "front-facing side"])) {
    next = `${next} Clear 3/4 (~45 degrees), camera on the front-facing side of the pose.`;
  }

  if (!includesAny(next, ["fixed camera"])) {
    next = `${next} Fixed camera.`;
  }

  if (!includesAny(next, ["transparent background"])) {
    next = `${next} Transparent background.`;
  }

  if (!includesAny(next, ["full body visible", "full body"])) {
    next = `${next} Full body visible.`;
  }

  return next.replace(/\s+/g, " ").trim();
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

export function validateMannequinPrompt(
  prompt: string,
  viewType?: "front" | "angled",
): ValidationResult {
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  if (includesForbidden(prompt, FORBIDDEN_MANNEQUIN)) {
    hardErrors.push("mannequin_forbidden_style");
  }

  if (!includesAny(prompt, ["fixed camera"])) {
    hardErrors.push("mannequin_missing_fixed_camera");
  }

  if (!includesAny(prompt, ["transparent background"])) {
    hardErrors.push("mannequin_missing_transparent_background");
  }

  if (!includesAny(prompt, ["full body"])) {
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
    if (!includesAny(prompt, ["strict front", "body facing the mat front", "front-facing"])) {
      warnings.push("mannequin_missing_front_view");
    }
  }

  if (viewType === "angled") {
    if (!includesAny(prompt, ["3/4", "45 degrees", "front-facing side"])) {
      warnings.push("mannequin_missing_angled_view");
    }
    if (
      !includesAny(prompt, [
        "visible depth",
        "main direction of the pose clearly visible",
        "not flat side view",
      ])
    ) {
      warnings.push("mannequin_missing_angled_depth");
    }
  }

  if (!includesAny(prompt, ["illustrated wooden artist mannequin", "illustrated wooden feel"])) {
    warnings.push("mannequin_missing_illustrated_lock");
  }

  if (includesForbidden(prompt, ["face", "facial features", "facial expression"])) {
    hardErrors.push("mannequin_mentions_face");
  }

  if (!includesAny(prompt, ["no face", "no facial features", "simplified head"])) {
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
