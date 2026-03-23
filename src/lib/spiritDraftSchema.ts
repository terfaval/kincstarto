import { z } from "zod";
import { SpiritFormatEnum, SpiritLevelEnum, SpiritStatusEnum, SpiritTraditionEnum } from "./spiritSchema";

const SpiritDraftBaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  tradition: SpiritTraditionEnum,
  level: SpiritLevelEnum,
  summary_short: z.string().default(""),
  recommendation: z.string().default(""),
  themes: z.array(z.string().min(1)).default([]),
  language: z.enum(["hu", "en", "egyeb"]).default("hu"),
  format: SpiritFormatEnum,
  status: SpiritStatusEnum.default("olvasatlan"),
  summary_long: z.string().default(""),
  prerequisites: z.array(z.string().min(1)).default([]),
  cautions: z.string().default(""),
  tags: z.array(z.string().min(1)).default([]),
  notes: z.string().default(""),
  year: z.string().nullable().optional(),
  related: z.array(z.string().min(1)).default([]),
});

export const SpiritDraftPreviewSchema = SpiritDraftBaseSchema;

export const SpiritDraftSchema = SpiritDraftBaseSchema.extend({
  summary_short: z.string().min(1),
  recommendation: z.string().min(1),
  themes: z.array(z.string().min(1)).min(1),
  summary_long: z.string().min(1),
  cautions: z.string().min(1),
});

export const SpiritDraftResponseSchema = z.object({
  draft: SpiritDraftSchema,
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

export const SpiritDraftPreviewResponseSchema = z.object({
  draft: SpiritDraftPreviewSchema,
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

export type SpiritDraft = z.infer<typeof SpiritDraftSchema>;
export type SpiritDraftResponse = z.infer<typeof SpiritDraftResponseSchema>;
export type SpiritDraftPreview = z.infer<typeof SpiritDraftPreviewSchema>;
export type SpiritDraftPreviewResponse = z.infer<typeof SpiritDraftPreviewResponseSchema>;
