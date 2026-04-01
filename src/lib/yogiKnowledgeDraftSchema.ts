import { z } from "zod";
import { AnatomySchema, KnowledgeCardSchema, PoseSchema } from "./yogiKnowledgeSchema";

export const PoseDraftSchema = PoseSchema.extend({
  tags: PoseSchema.shape.tags.min(0),
  purpose: PoseSchema.shape.purpose.min(0),
  attention_points: PoseSchema.shape.attention_points.min(0),
  alignment_cues: PoseSchema.shape.alignment_cues.min(0),
  self_check_statements: PoseSchema.shape.self_check_statements.min(0),
  common_mistakes: PoseSchema.shape.common_mistakes.min(0),
  stretches: PoseSchema.shape.stretches.min(0),
  strengthens: PoseSchema.shape.strengthens.min(0),
  activates: PoseSchema.shape.activates.min(0),
  relieves: PoseSchema.shape.relieves.min(0),
  body_regions: PoseSchema.shape.body_regions.min(0),
  contraindications: PoseSchema.shape.contraindications.min(0),
  caution_areas: PoseSchema.shape.caution_areas.min(0),
  modifications: PoseSchema.shape.modifications.min(0),
  props: PoseSchema.shape.props.min(0),
  anatomy_refs: PoseSchema.shape.anatomy_refs.min(0),
  related_pose_ids: PoseSchema.shape.related_pose_ids.min(0),
});
export const AnatomyDraftSchema = AnatomySchema;
export const KnowledgeCardDraftSchema = KnowledgeCardSchema;

export const YogiDraftSchema = z.discriminatedUnion("entity_type", [
  z.object({ entity_type: z.literal("pose"), draft: PoseDraftSchema }),
  z.object({ entity_type: z.literal("anatomy"), draft: AnatomyDraftSchema }),
  z.object({ entity_type: z.literal("knowledge_card"), draft: KnowledgeCardDraftSchema }),
]);

export const YogiDraftResponseSchema = z.object({
  entity_type: z.enum(["pose", "anatomy", "knowledge_card"]),
  draft: z.union([PoseDraftSchema, AnatomyDraftSchema, KnowledgeCardDraftSchema]),
  confidence: z.record(z.string(), z.number().or(z.string())).optional().default({}),
  warnings: z.array(z.string()).default([]),
  uncertain_fields: z.array(z.string()).default([]),
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().optional(),
      })
    )
    .default([]),
});

export type PoseDraft = z.infer<typeof PoseDraftSchema>;
export type AnatomyDraft = z.infer<typeof AnatomyDraftSchema>;
export type KnowledgeCardDraft = z.infer<typeof KnowledgeCardDraftSchema>;
export type YogiDraftResponse = z.infer<typeof YogiDraftResponseSchema>;
