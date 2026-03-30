import { z } from "zod";
import { AnatomySchema, KnowledgeCardSchema, PoseSchema } from "./yogiKnowledgeSchema";

export const PoseDraftSchema = PoseSchema;
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
