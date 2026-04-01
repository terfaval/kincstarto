import { z } from "zod";

export const YogaVideoStyleEnum = z.enum([
  "flow",
  "vinyasa",
  "yin",
  "restorative",
  "power",
  "mobility",
  "stretch",
  "breath",
]);

export type YogaVideoStyle = z.infer<typeof YogaVideoStyleEnum>;

export const YogaVideoMetaSchema = z.object({
  yoga_id: z.string().min(1),
  title_override: z.string().min(1).nullable().optional(),
  channel: z.string().min(1).nullable().optional(),
  style: YogaVideoStyleEnum.nullable().optional(),
  description_short: z.string().min(1).nullable().optional(),
  description_long: z.string().min(1).nullable().optional(),
  pose_ids: z.array(z.string().min(1)).optional(),
  focus_tags: z.array(z.string().min(1)).optional(),
  props: z.array(z.string().min(1)).optional(),
  language: z.string().min(1).nullable().optional(),
});

export type YogaVideoMeta = z.infer<typeof YogaVideoMetaSchema>;
