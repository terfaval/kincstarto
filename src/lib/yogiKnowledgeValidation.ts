import type { Anatomy, KnowledgeCard, Pose } from "./yogiKnowledgeSchema";

const FORBIDDEN_PHRASES = [
  "holisztikus",
  "gyogyito",
  "energiak aramlasa",
  "optimalizalja",
  "szamos elony",
  "legjobb onmagad",
  "mely kapcsolat onmagaddal",
];

const MEDICAL_CLAIMS = [
  "gyogyit",
  "gyogyitas",
  "terapia",
  "diagnoszt",
  "diagnosztiz",
  "kezel",
  "kezeles",
  "betegseg",
  "orvosi",
  "medical",
  "diagnose",
  "treat",
  "cure",
  "therapy",
];

const AI_SOUNDING = [
  "osszessgeben",
  "tokeletes",
  "idealis",
  "fedezd fel",
  "tapastal",
  "tapasztalj",
];

const ANATOMY_JARGON = [
  "latissimus",
  "gluteus",
  "iliopsoas",
  "scapula",
  "scapular",
  "thoracic",
  "lumbar",
  "sacroiliac",
  "rotator",
  "subscapularis",
  "supraspinatus",
  "infraspinatus",
  "sternum",
  "clavicle",
  "femur",
  "tibia",
  "fibula",
];

const TECHNICAL_LATIN = [
  "teres",
  "major",
  "minor",
  "supraspinatus",
  "infraspinatus",
  "subscapularis",
  "pectoralis",
  "iliopsoas",
  "quadratus",
  "trapezius",
  "rhomboid",
];

const KNOWN_POSE_SLUGS = new Set([
  "downward_facing_dog",
  "child_pose",
  "mountain",
  "plank",
  "chaturanga",
  "upward_facing_dog",
  "cobra",
  "warrior_i",
  "warrior_ii",
  "triangle",
  "tree",
  "bridge",
  "seated_forward_fold",
  "cat_cow",
  "low_lunge",
  "high_lunge",
  "pigeon",
  "garland",
  "staff",
  "boat",
  "half_moon",
  "extended_side_angle",
  "eagle",
  "corpse",
]);

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function collectText(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

function containsAny(text: string, list: string[]) {
  const normalized = normalizeText(text);
  return list.some((phrase) => normalized.includes(normalizeText(phrase)));
}

function countMatches(text: string, list: string[]) {
  const normalized = normalizeText(text);
  return list.reduce((count, phrase) => (normalized.includes(normalizeText(phrase)) ? count + 1 : count), 0);
}

type ValidationResult = {
  hardErrors: string[];
  warnings: string[];
};

function checkForbidden(texts: string[]): string[] {
  const errors: string[] = [];
  texts.forEach((text) => {
    if (containsAny(text, FORBIDDEN_PHRASES)) {
      errors.push("forbidden_phrase");
    }
    if (containsAny(text, MEDICAL_CLAIMS)) {
      errors.push("medical_claim");
    }
  });
  return errors;
}

function checkAiSounding(texts: string[]): string[] {
  const warnings: string[] = [];
  texts.forEach((text) => {
    if (containsAny(text, AI_SOUNDING)) warnings.push("ai_sounding_phrase");
  });
  return warnings;
}

function checkSummaryGeneric(summary: string) {
  const words = summary.trim().split(/\s+/).filter(Boolean);
  if (words.length < 8) return ["summary_too_generic"];
  return [];
}

function checkJargon(texts: string[]) {
  const warnings: string[] = [];
  const total = texts.reduce((count, text) => count + countMatches(text, ANATOMY_JARGON), 0);
  if (total >= 5) warnings.push("too_much_anatomy_jargon");
  return warnings;
}

function checkTechnicalLatin(texts: string[]) {
  const warnings: string[] = [];
  const total = texts.reduce((count, text) => count + countMatches(text, TECHNICAL_LATIN), 0);
  if (total > 0) warnings.push("technical_latin_terms");
  return warnings;
}

function checkListLimit(list: string[], max: number, code: string) {
  if (list.length > max) return [code];
  return [];
}

function countSentences(text: string) {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function checkSentenceLimit(text: string, max: number, code: string) {
  return countSentences(text) > max ? [code] : [];
}

function checkOverlap(attention: string[], alignment: string[]) {
  const set = new Set(attention.map((item) => normalizeText(item)));
  const overlap = alignment.some((item) => set.has(normalizeText(item)));
  return overlap ? ["attention_alignment_overlap"] : [];
}

function checkSelfCheckQuestions(items: string[]) {
  const hasQuestion = items.some((item) => item.includes("?"));
  return hasQuestion ? ["self_check_question_form"] : [];
}

export function validatePoseQuality(
  pose: Pose,
  opts: { poseMode?: "known" | "functional"; expectedSlug?: string } = {}
): ValidationResult {
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  const texts = [
    ...collectText(pose.summary),
    ...collectText(pose.purpose),
    ...collectText(pose.setup),
    ...collectText(pose.entry),
    ...collectText(pose.hold),
    ...collectText(pose.exit),
    ...collectText(pose.breath),
    ...collectText(pose.attention_points),
    ...collectText(pose.alignment_cues),
    ...collectText(pose.self_check_statements),
    ...collectText(pose.common_mistakes),
    ...collectText(pose.stretches),
    ...collectText(pose.strengthens),
    ...collectText(pose.activates),
    ...collectText(pose.relieves),
    ...collectText(pose.contraindications),
    ...collectText(pose.caution_areas),
    ...collectText(pose.modifications),
    ...collectText(pose.pain_notes),
  ];

  hardErrors.push(...checkForbidden(texts));
  hardErrors.push(...checkSelfCheckQuestions(pose.self_check_statements));

  if (opts.poseMode === "known" && opts.expectedSlug) {
    const expected = normalizeText(opts.expectedSlug);
    const actual = normalizeText(pose.slug);
    if (actual !== expected) hardErrors.push("pose_slug_mismatch");
  }

  if (opts.poseMode === "functional") {
    if (!KNOWN_POSE_SLUGS.has(pose.slug)) hardErrors.push("unknown_pose_slug");
  }

  warnings.push(...checkOverlap(pose.attention_points, pose.alignment_cues));
  warnings.push(...checkSummaryGeneric(pose.summary));
  warnings.push(...checkAiSounding(texts));
  warnings.push(...checkTechnicalLatin(texts));
  warnings.push(...checkListLimit(pose.purpose, 3, "purpose_too_long"));
  warnings.push(...checkListLimit(pose.attention_points, 4, "attention_points_too_long"));
  warnings.push(...checkListLimit(pose.alignment_cues, 4, "alignment_cues_too_long"));
  warnings.push(...checkListLimit(pose.self_check_statements, 5, "self_check_too_long"));
  warnings.push(...checkListLimit(pose.common_mistakes, 4, "common_mistakes_too_long"));
  warnings.push(...checkListLimit(pose.stretches, 4, "stretches_too_long"));
  warnings.push(...checkListLimit(pose.strengthens, 4, "strengthens_too_long"));
  warnings.push(...checkListLimit(pose.activates, 4, "activates_too_long"));
  warnings.push(...checkListLimit(pose.relieves, 3, "relieves_too_long"));
  warnings.push(...checkListLimit(pose.contraindications, 3, "contraindications_too_long"));
  warnings.push(...checkListLimit(pose.modifications, 5, "modifications_too_long"));
  warnings.push(...checkListLimit(pose.props, 5, "props_too_long"));

  return { hardErrors: unique(hardErrors), warnings: unique(warnings) };
}

export function validateAnatomyQuality(anatomy: Anatomy): ValidationResult {
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  const texts = [
    ...collectText(anatomy.description),
    ...collectText(anatomy.role_in_movement),
    ...collectText(anatomy.why_relevant_in_yoga),
    ...collectText(anatomy.common_patterns),
    ...collectText(anatomy.tension_patterns),
    ...collectText(anatomy.weakness_patterns),
    ...collectText(anatomy.awareness_cues),
    ...collectText(anatomy.discomfort_notes),
    ...collectText(anatomy.safe_practice_notes),
  ];

  hardErrors.push(...checkForbidden(texts));
  warnings.push(...checkAiSounding(texts));
  warnings.push(...checkJargon(texts));
  warnings.push(...checkTechnicalLatin(texts));
  warnings.push(...checkListLimit(anatomy.common_patterns, 4, "common_patterns_too_long"));
  warnings.push(...checkListLimit(anatomy.tension_patterns, 4, "tension_patterns_too_long"));
  warnings.push(...checkListLimit(anatomy.weakness_patterns, 4, "weakness_patterns_too_long"));
  warnings.push(...checkListLimit(anatomy.awareness_cues, 4, "awareness_cues_too_long"));
  warnings.push(...checkSentenceLimit(anatomy.description, 3, "description_too_long"));
  warnings.push(...checkSentenceLimit(anatomy.role_in_movement, 3, "role_in_movement_too_long"));
  warnings.push(...checkSentenceLimit(anatomy.why_relevant_in_yoga, 3, "why_relevant_in_yoga_too_long"));

  return { hardErrors: unique(hardErrors), warnings: unique(warnings) };
}

export function validateKnowledgeCardQuality(card: KnowledgeCard): ValidationResult {
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  const texts = [
    ...collectText(card.summary),
    ...collectText(card.key_points),
  ];

  hardErrors.push(...checkForbidden(texts));
  warnings.push(...checkAiSounding(texts));
  warnings.push(...checkSummaryGeneric(card.summary));

  return { hardErrors: unique(hardErrors), warnings: unique(warnings) };
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
