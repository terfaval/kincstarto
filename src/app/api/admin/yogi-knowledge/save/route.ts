import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { PoseSchema, AnatomySchema, KnowledgeCardSchema } from "@/lib/yogiKnowledgeSchema";
import { getYogiKnowledgeStore, normalizeSlug, createYogiId } from "@/lib/yogiKnowledgeStore";
import { validatePoseQuality, validateAnatomyQuality, validateKnowledgeCardQuality } from "@/lib/yogiKnowledgeValidation";

export const runtime = "nodejs";

type SaveIntent = "save" | "publish" | "archive";

type Payload =
  | { entity_type: "pose"; item: unknown; intent?: SaveIntent }
  | { entity_type: "anatomy"; item: unknown; intent?: SaveIntent }
  | { entity_type: "knowledge_card"; item: unknown; intent?: SaveIntent };

function phaseError(phase: string, error_code: string, detail: string, status = 500) {
  return NextResponse.json({ error: "Save failed", phase, error_code, detail }, { status });
}

function applyIntentStatus(item: any, intent: SaveIntent | undefined) {
  if (!intent || intent === "save") return item;
  if (intent === "publish") return { ...item, status: "active", content_status: "published" };
  if (intent === "archive") return { ...item, status: "archived", content_status: "archived" };
  return item;
}

function canPublishContent(contentStatus: unknown) {
  return contentStatus === "verified" || contentStatus === "published";
}

function checkPublishGate(item: any, entityType: Payload["entity_type"]) {
  if (!canPublishContent(item?.content_status)) {
    return "content_not_verified";
  }
  if (entityType === "pose") {
    if (item?.mannequin_angled?.status !== "verified") return "mannequin_angled_not_verified";
  }
  if (entityType === "anatomy") {
    if (item?.scientific_image?.status !== "verified") return "scientific_image_not_verified";
  }
  return null;
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch (err) {
    return phaseError("request_parse", "INVALID_JSON", (err as Error)?.message ?? "Invalid JSON", 400);
  }

  if (!payload?.entity_type || !payload?.item) {
    return phaseError("request_parse", "MISSING_PAYLOAD", "entity_type and item are required", 400);
  }

  const store = getYogiKnowledgeStore();
  const intent = payload.intent ?? "save";

  if (payload.entity_type === "pose") {
    if (intent === "publish") {
      const gate = checkPublishGate(payload.item, "pose");
      if (gate) return phaseError("publish_gate", "PUBLISH_GATED", gate, 400);
    }
    const normalized = applyIntentStatus(payload.item, intent);
    const parsed = PoseSchema.safeParse(normalized);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
      return phaseError("schema", "POSE_SCHEMA_INVALID", detail, 400);
    }

    const pose = parsed.data;
    const quality = validatePoseQuality(pose);
    if (quality.hardErrors.length > 0) {
      return phaseError("quality_check", "POSE_HARD_REJECT", quality.hardErrors.join(" | "), 400);
    }

    const poses = await store.listPoses();
    const slug = normalizeSlug(pose.slug);
    const id = pose.id || createYogiId("pose", slug);
    const existingIndex = poses.findIndex((item) => item.id === id);
    const slugIndex = poses.findIndex((item) => normalizeSlug(item.slug) === slug);

    const next = { ...pose, id, slug };
    if (existingIndex === -1 && slugIndex !== -1) {
      return phaseError("dedupe", "DUPLICATE_SLUG", "Pose slug already exists", 400);
    }

    if (existingIndex === -1) poses.push(next);
    else poses[existingIndex] = next;
    await store.savePoses(poses);

    return NextResponse.json({ ok: true, id: next.id, warnings: quality.warnings });
  }

  if (payload.entity_type === "anatomy") {
    if (intent === "publish") {
      const gate = checkPublishGate(payload.item, "anatomy");
      if (gate) return phaseError("publish_gate", "PUBLISH_GATED", gate, 400);
    }
    const normalized = applyIntentStatus(payload.item, intent);
    const parsed = AnatomySchema.safeParse(normalized);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
      return phaseError("schema", "ANATOMY_SCHEMA_INVALID", detail, 400);
    }

    const anatomy = parsed.data;
    const quality = validateAnatomyQuality(anatomy);
    if (quality.hardErrors.length > 0) {
      return phaseError("quality_check", "ANATOMY_HARD_REJECT", quality.hardErrors.join(" | "), 400);
    }

    const items = await store.listAnatomy();
    const slug = normalizeSlug(anatomy.slug);
    const id = anatomy.id || createYogiId("anat", slug);
    const existingIndex = items.findIndex((item) => item.id === id);
    const slugIndex = items.findIndex((item) => normalizeSlug(item.slug) === slug);

    const next = { ...anatomy, id, slug };
    if (existingIndex === -1 && slugIndex !== -1) {
      return phaseError("dedupe", "DUPLICATE_SLUG", "Anatomy slug already exists", 400);
    }

    if (existingIndex === -1) items.push(next);
    else items[existingIndex] = next;
    await store.saveAnatomy(items);

    return NextResponse.json({ ok: true, id: next.id, warnings: quality.warnings });
  }

  if (payload.entity_type === "knowledge_card") {
    if (intent === "publish") {
      const gate = checkPublishGate(payload.item, "knowledge_card");
      if (gate) return phaseError("publish_gate", "PUBLISH_GATED", gate, 400);
    }
    const normalized = applyIntentStatus(payload.item, intent);
    const parsed = KnowledgeCardSchema.safeParse(normalized);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
      return phaseError("schema", "CARD_SCHEMA_INVALID", detail, 400);
    }

    const card = parsed.data;
    const quality = validateKnowledgeCardQuality(card);
    if (quality.hardErrors.length > 0) {
      return phaseError("quality_check", "CARD_HARD_REJECT", quality.hardErrors.join(" | "), 400);
    }

    const items = await store.listKnowledgeCards();
    const slug = normalizeSlug(card.slug);
    const id = card.id || createYogiId("card", slug);
    const existingIndex = items.findIndex((item) => item.id === id);
    const slugIndex = items.findIndex((item) => normalizeSlug(item.slug) === slug);

    const next = { ...card, id, slug };
    if (existingIndex === -1 && slugIndex !== -1) {
      return phaseError("dedupe", "DUPLICATE_SLUG", "KnowledgeCard slug already exists", 400);
    }

    if (existingIndex === -1) items.push(next);
    else items[existingIndex] = next;
    await store.saveKnowledgeCards(items);

    return NextResponse.json({ ok: true, id: next.id, warnings: quality.warnings });
  }

  return phaseError("request_parse", "UNKNOWN_ENTITY_TYPE", "Unknown entity_type", 400);
}
