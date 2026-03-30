import { YogiKnowledgeMetadataSchema } from "./yogiKnowledgeSchema";

export function validateYogiKnowledgeMetadata(value: unknown) {
  const parsed = YogiKnowledgeMetadataSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | "),
    };
  }
  return { ok: true as const, data: parsed.data };
}
