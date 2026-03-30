import { z } from "zod";

export const YogiStatusEnum = z.enum(["draft", "active", "archived"]);
export const ContentStatusEnum = z.enum(["draft", "verified", "published", "archived"]);
export const ImageSlotStatusEnum = z.enum(["missing", "generated", "verified"]);

export type YogiStatus = z.infer<typeof YogiStatusEnum>;
export type ContentStatus = z.infer<typeof ContentStatusEnum>;
export type ImageSlotStatus = z.infer<typeof ImageSlotStatusEnum>;

const DurationSchema = z
  .object({
    min_seconds: z.number().int().min(1),
    max_seconds: z.number().int().min(1),
  })
  .refine((value) => value.max_seconds >= value.min_seconds, {
    message: "duration.max_seconds must be >= duration.min_seconds",
  });

export const PoseCategoryEnum = z.enum([
  "standing",
  "seated",
  "supine",
  "prone",
  "kneeling",
  "balance",
  "twist",
  "backbend",
  "forward_fold",
  "restorative",
]);

export const PoseLevelEnum = z.enum(["beginner", "intermediate", "advanced", "all_levels"]);

export const KnowledgeCategoryEnum = z.enum([
  "breath",
  "alignment",
  "safety",
  "practice",
  "beginners",
  "recovery",
]);

export const PosePurposeEnum = z.enum([
  "mobilizing",
  "stretching",
  "strengthening",
  "stabilizing",
  "restorative",
  "grounding",
  "energizing",
]);

export type PoseCategory = z.infer<typeof PoseCategoryEnum>;
export type PoseLevel = z.infer<typeof PoseLevelEnum>;
export type KnowledgeCategory = z.infer<typeof KnowledgeCategoryEnum>;
export type PosePurpose = z.infer<typeof PosePurposeEnum>;

export const AnatomyTypeEnum = z.enum(["muscle", "joint", "area", "system"]);

const ImageSlotSchema = z.object({
  spec: z.string().min(1).nullable().optional(),
  prompt: z.string().min(1),
  asset_ref: z.string().min(1).nullable(),
  status: ImageSlotStatusEnum,
  warning: z.string().min(1).nullable().optional(),
  warning_detail: z.string().min(1).nullable().optional(),
  prompt_revision: z.number().int().nullable().optional(),
});

export const PoseSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name_hu: z.string().min(1),
  name_en: z.string().min(1),
  sanskrit_name: z.string().min(1).nullable().optional(),
  category: PoseCategoryEnum,
  level: PoseLevelEnum,
  tags: z.array(z.string().min(1)).min(1),
  status: YogiStatusEnum,
  content_status: ContentStatusEnum,
  summary: z.string().min(1),
  purpose: z.array(PosePurposeEnum).min(1),
  setup: z.string().min(1),
  entry: z.string().min(1),
  hold: z.string().min(1),
  exit: z.string().min(1),
  breath: z.string().min(1),
  duration: DurationSchema,
  attention_points: z.array(z.string().min(1)).min(1),
  alignment_cues: z.array(z.string().min(1)).min(1),
  self_check_statements: z.array(z.string().min(1)).min(1),
  common_mistakes: z.array(z.string().min(1)).min(1),
  stretches: z.array(z.string().min(1)).min(1),
  strengthens: z.array(z.string().min(1)),
  activates: z.array(z.string().min(1)).min(1),
  relieves: z.array(z.string().min(1)),
  body_regions: z.array(z.string().min(1)).min(1),
  contraindications: z.array(z.string().min(1)),
  caution_areas: z.array(z.string().min(1)),
  modifications: z.array(z.string().min(1)),
  props: z.array(z.string().min(1)),
  pain_notes: z.string().min(1),
  anatomy_refs: z.array(z.string().min(1)),
  related_pose_ids: z.array(z.string().min(1)),
  mannequin_front: ImageSlotSchema.optional(),
  mannequin_angled: ImageSlotSchema,
  ai_generated: z.boolean(),
  ai_confidence: z.number().min(0).max(1).nullable().optional(),
  validated: z.boolean(),
  validated_by: z.string().min(1).nullable().optional(),
});

export const AnatomySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name_hu: z.string().min(1),
  name_en: z.string().min(1),
  name_latin: z.string().min(1).nullable().optional(),
  region: z.string().min(1),
  type: AnatomyTypeEnum,
  tags: z.array(z.string().min(1)).min(1),
  status: YogiStatusEnum,
  content_status: ContentStatusEnum,
  description: z.string().min(1),
  role_in_movement: z.string().min(1),
  why_relevant_in_yoga: z.string().min(1),
  common_patterns: z.array(z.string().min(1)).min(1),
  tension_patterns: z.array(z.string().min(1)).min(1),
  weakness_patterns: z.array(z.string().min(1)).min(1),
  stretch_pose_ids: z.array(z.string().min(1)),
  strengthen_pose_ids: z.array(z.string().min(1)),
  mobility_pose_ids: z.array(z.string().min(1)),
  caution_pose_ids: z.array(z.string().min(1)),
  awareness_cues: z.array(z.string().min(1)).min(1),
  discomfort_notes: z.string().min(1),
  safe_practice_notes: z.string().min(1),
  scientific_image: ImageSlotSchema,
  ai_generated: z.boolean(),
  validated: z.boolean(),
});

export const KnowledgeCardSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title_hu: z.string().min(1),
  category: KnowledgeCategoryEnum,
  tags: z.array(z.string().min(1)).min(1),
  status: YogiStatusEnum,
  content_status: ContentStatusEnum,
  summary: z.string().min(1),
  key_points: z.array(z.string().min(1)).min(1),
  related_pose_ids: z.array(z.string().min(1)),
  related_anatomy_ids: z.array(z.string().min(1)),
  ai_generated: z.boolean(),
  validated: z.boolean(),
});

export type Pose = z.infer<typeof PoseSchema>;
export type Anatomy = z.infer<typeof AnatomySchema>;
export type KnowledgeCard = z.infer<typeof KnowledgeCardSchema>;

export const YogiKnowledgeRefSchema = z.object({
  subject_type: z.enum(["pose", "anatomy", "knowledge_card"]),
  subject_id: z.string().min(1),
  relation: z.string().min(1),
});

export const YogiKnowledgeMetadataSchema = z.object({
  primary_pose_id: z.string().min(1).optional(),
  knowledge_refs: z.array(YogiKnowledgeRefSchema).min(1),
});

export type YogiKnowledgeRef = z.infer<typeof YogiKnowledgeRefSchema>;
export type YogiKnowledgeMetadata = z.infer<typeof YogiKnowledgeMetadataSchema>;
