import { NextResponse } from "next/server";
import OpenAI from "openai";
import { YogiDraftResponseSchema } from "@/lib/yogiKnowledgeDraftSchema";
import { PoseSchema, AnatomySchema, KnowledgeCardSchema, type Pose, type Anatomy } from "@/lib/yogiKnowledgeSchema";
import { normalizeSlug, createYogiId } from "@/lib/yogiKnowledgeStore";
import { validatePoseQuality, validateAnatomyQuality, validateKnowledgeCardQuality } from "@/lib/yogiKnowledgeValidation";
import { requireAdmin } from "@/lib/adminAuth";
import { buildAnatomyImageSlot, buildPoseImageSlots, buildPoseImageSlotsWithSpec, validateAnatomyImageSlot, validatePoseImageSlots } from "@/lib/yogiImagePrompts";
import { generatePoseImageSpecAI } from "@/lib/yogiImageSpecAI";

export const runtime = "nodejs";

const KNOWN_POSES = [
  { slug: "downward_facing_dog", name_hu: "Lefele nezo kutya", name_en: "Downward-Facing Dog" },
  { slug: "child_pose", name_hu: "Gyermekpoz", name_en: "Child's Pose" },
  { slug: "mountain", name_hu: "Hegyallas", name_en: "Mountain Pose" },
  { slug: "plank", name_hu: "Plank", name_en: "Plank" },
  { slug: "chaturanga", name_hu: "Chaturanga", name_en: "Chaturanga" },
  { slug: "upward_facing_dog", name_hu: "Felfele nezo kutya", name_en: "Upward-Facing Dog" },
  { slug: "cobra", name_hu: "Kobra", name_en: "Cobra Pose" },
  { slug: "warrior_i", name_hu: "Harcos I", name_en: "Warrior I" },
  { slug: "warrior_ii", name_hu: "Harcos II", name_en: "Warrior II" },
  { slug: "triangle", name_hu: "Haromszog", name_en: "Triangle Pose" },
  { slug: "tree", name_hu: "Fa", name_en: "Tree Pose" },
  { slug: "bridge", name_hu: "Hid", name_en: "Bridge Pose" },
  { slug: "seated_forward_fold", name_hu: "Ulo elorehajlas", name_en: "Seated Forward Fold" },
  { slug: "cat_cow", name_hu: "Macska-tehen", name_en: "Cat-Cow" },
  { slug: "low_lunge", name_hu: "Alacsony kitore", name_en: "Low Lunge" },
  { slug: "high_lunge", name_hu: "Magas kitore", name_en: "High Lunge" },
  { slug: "pigeon", name_hu: "Galamb", name_en: "Pigeon Pose" },
  { slug: "garland", name_hu: "Guggolo fuzer", name_en: "Garland Pose" },
  { slug: "staff", name_hu: "Botpoz", name_en: "Staff Pose" },
  { slug: "boat", name_hu: "Csonak", name_en: "Boat Pose" },
  { slug: "half_moon", name_hu: "Felhold", name_en: "Half Moon Pose" },
  { slug: "extended_side_angle", name_hu: "Nyujtott oldalszog", name_en: "Extended Side Angle" },
  { slug: "eagle", name_hu: "Sas", name_en: "Eagle Pose" },
  { slug: "corpse", name_hu: "Hullapoz", name_en: "Corpse Pose" },
];

const KNOWN_POSE_SANSKRIT: Record<string, string> = {
  downward_facing_dog: "Adho Mukha Svanasana",
  child_pose: "Balasana",
  mountain: "Tadasana",
  plank: "Phalakasana",
  chaturanga: "Chaturanga Dandasana",
  upward_facing_dog: "Urdhva Mukha Svanasana",
  cobra: "Bhujangasana",
  warrior_i: "Virabhadrasana I",
  warrior_ii: "Virabhadrasana II",
  triangle: "Trikonasana",
  tree: "Vrksasana",
  bridge: "Setu Bandha Sarvangasana",
  seated_forward_fold: "Paschimottanasana",
  cat_cow: "Marjaryasana-Bitilasana",
  low_lunge: "Anjaneyasana",
  high_lunge: "Alanasana",
  pigeon: "Eka Pada Rajakapotasana",
  garland: "Malasana",
  staff: "Dandasana",
  boat: "Navasana",
  half_moon: "Ardha Chandrasana",
  extended_side_angle: "Utthita Parsvakonasana",
  eagle: "Garudasana",
  corpse: "Savasana",
};

const FORBIDDEN_PHRASES = [
  "holisztikus",
  "gyogyito",
  "energiak aramlasa",
  "optimalizalja",
  "szamos elony",
  "legjobb onmagad",
  "mely kapcsolat onmagaddal",
];

type PosePayload = {
  entity_type: "pose";
  pose_mode: "known" | "functional";
  pose_name?: string;
  pose_slug?: string;
  functional_goal?: string;
};

type AnatomyPayload = {
  entity_type: "anatomy";
  topic: string;
};

type KnowledgeCardPayload = {
  entity_type: "knowledge_card";
  topic: string;
};

type Payload = PosePayload | AnatomyPayload | KnowledgeCardPayload;

function phaseError(phase: string, error_code: string, detail: string, status = 500) {
  return NextResponse.json({ error: "Draft failed", phase, error_code, detail }, { status });
}

function getOutputText(response: any) {
  const direct = response?.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const items = Array.isArray(response?.output) ? response.output : [];
  for (const item of items) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
    const textPart = item.content.find((part: any) => part?.type === "output_text" || part?.type === "text");
    if (textPart?.text) return textPart.text as string;
  }
  return "";
}

function parseStrictJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("Model output was not strict JSON.");
  }
  return JSON.parse(trimmed);
}

function buildResponseFormat(entityType: Payload["entity_type"]) {
  const base = {
    type: "object",
    additionalProperties: false,
    required: ["entity_type", "draft", "confidence", "warnings", "uncertain_fields", "sources"],
    properties: {
      entity_type: { type: "string", enum: [entityType] },
      confidence: { type: "object", additionalProperties: true },
      warnings: { type: "array", items: { type: "string" } },
      uncertain_fields: { type: "array", items: { type: "string" } },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title"],
          properties: {
            title: { type: "string" },
            url: { type: "string" },
          },
        },
      },
    },
  } as const;

  if (entityType === "pose") {
    return {
      name: "yogi_knowledge_pose_draft",
      description: "Yogi Knowledge pose draft",
      strict: true,
      schema: {
        ...base,
        properties: {
          ...base.properties,
          draft: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "slug",
              "name_hu",
              "name_en",
              "category",
              "level",
              "tags",
              "status",
              "content_status",
              "summary",
              "purpose",
              "setup",
              "entry",
              "hold",
              "exit",
              "breath",
              "duration",
              "attention_points",
              "alignment_cues",
              "self_check_statements",
              "common_mistakes",
              "stretches",
              "strengthens",
              "activates",
              "relieves",
              "body_regions",
              "contraindications",
              "caution_areas",
              "modifications",
              "props",
              "pain_notes",
              "anatomy_refs",
              "related_pose_ids",
              "mannequin_angled",
              "ai_generated",
              "ai_confidence",
              "validated",
              "validated_by",
            ],
            properties: {
              id: { type: "string" },
              slug: { type: "string" },
              name_hu: { type: "string" },
              name_en: { type: "string" },
              sanskrit_name: { type: ["string", "null"] },
              category: {
                type: "string",
                enum: [
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
                ],
              },
              level: { type: "string", enum: ["beginner", "intermediate", "advanced", "all_levels"] },
              tags: { type: "array", items: { type: "string" } },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              content_status: { type: "string", enum: ["draft", "verified", "published", "archived"] },
              summary: { type: "string" },
              purpose: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "mobilizing",
                    "stretching",
                    "strengthening",
                    "stabilizing",
                    "restorative",
                    "grounding",
                    "energizing",
                  ],
                },
              },
              setup: { type: "string" },
              entry: { type: "string" },
              hold: { type: "string" },
              exit: { type: "string" },
              breath: { type: "string" },
              duration: {
                type: "object",
                additionalProperties: false,
                required: ["min_seconds", "max_seconds"],
                properties: {
                  min_seconds: { type: "number" },
                  max_seconds: { type: "number" },
                },
              },
              attention_points: { type: "array", items: { type: "string" } },
              alignment_cues: { type: "array", items: { type: "string" } },
              self_check_statements: { type: "array", items: { type: "string" } },
              common_mistakes: { type: "array", items: { type: "string" } },
              stretches: { type: "array", items: { type: "string" } },
              strengthens: { type: "array", items: { type: "string" } },
              activates: { type: "array", items: { type: "string" } },
              relieves: { type: "array", items: { type: "string" } },
              body_regions: { type: "array", items: { type: "string" } },
              contraindications: { type: "array", items: { type: "string" } },
              caution_areas: { type: "array", items: { type: "string" } },
              modifications: { type: "array", items: { type: "string" } },
              props: { type: "array", items: { type: "string" } },
              pain_notes: { type: "string" },
              anatomy_refs: { type: "array", items: { type: "string" } },
              related_pose_ids: { type: "array", items: { type: "string" } },
              mannequin_front: {
                type: "object",
                additionalProperties: false,
                required: ["prompt", "asset_ref", "status"],
                properties: {
                  spec: { type: ["string", "null"] },
                  prompt: { type: "string" },
                  asset_ref: { type: ["string", "null"] },
                  status: { type: "string", enum: ["missing", "generated", "verified"] },
                },
              },
              mannequin_angled: {
                type: "object",
                additionalProperties: false,
                required: ["prompt", "asset_ref", "status"],
                properties: {
                  spec: { type: ["string", "null"] },
                  prompt: { type: "string" },
                  asset_ref: { type: ["string", "null"] },
                  status: { type: "string", enum: ["missing", "generated", "verified"] },
                },
              },
              ai_generated: { type: "boolean" },
              ai_confidence: { type: ["number", "null"] },
              validated: { type: "boolean" },
              validated_by: { type: ["string", "null"] },
            },
          },
        },
      },
    };
  }

  if (entityType === "anatomy") {
    return {
      name: "yogi_knowledge_anatomy_draft",
      description: "Yogi Knowledge anatomy draft",
      strict: true,
      schema: {
        ...base,
        properties: {
          ...base.properties,
          draft: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "slug",
              "name_hu",
              "name_en",
              "region",
              "type",
              "tags",
              "status",
              "content_status",
              "description",
              "role_in_movement",
              "why_relevant_in_yoga",
              "common_patterns",
              "tension_patterns",
              "weakness_patterns",
              "stretch_pose_ids",
              "strengthen_pose_ids",
              "mobility_pose_ids",
              "caution_pose_ids",
              "awareness_cues",
              "discomfort_notes",
              "safe_practice_notes",
              "scientific_image",
              "ai_generated",
              "validated",
            ],
            properties: {
              id: { type: "string" },
              slug: { type: "string" },
              name_hu: { type: "string" },
              name_en: { type: "string" },
              name_latin: { type: ["string", "null"] },
              region: { type: "string" },
              type: { type: "string", enum: ["muscle", "joint", "area", "system"] },
              tags: { type: "array", items: { type: "string" } },
              status: { type: "string", enum: ["draft", "active", "archived"] },
              content_status: { type: "string", enum: ["draft", "verified", "published", "archived"] },
              description: { type: "string" },
              role_in_movement: { type: "string" },
              why_relevant_in_yoga: { type: "string" },
              common_patterns: { type: "array", items: { type: "string" } },
              tension_patterns: { type: "array", items: { type: "string" } },
              weakness_patterns: { type: "array", items: { type: "string" } },
              stretch_pose_ids: { type: "array", items: { type: "string" } },
              strengthen_pose_ids: { type: "array", items: { type: "string" } },
              mobility_pose_ids: { type: "array", items: { type: "string" } },
              caution_pose_ids: { type: "array", items: { type: "string" } },
              awareness_cues: { type: "array", items: { type: "string" } },
              discomfort_notes: { type: "string" },
              safe_practice_notes: { type: "string" },
              scientific_image: {
                type: "object",
                additionalProperties: false,
                required: ["prompt", "asset_ref", "status"],
                properties: {
                  spec: { type: ["string", "null"] },
                  prompt: { type: "string" },
                  asset_ref: { type: ["string", "null"] },
                  status: { type: "string", enum: ["missing", "generated", "verified"] },
                },
              },
              ai_generated: { type: "boolean" },
              validated: { type: "boolean" },
            },
          },
        },
      },
    };
  }

  return {
    name: "yogi_knowledge_card_draft",
    description: "Yogi Knowledge knowledge card draft",
    strict: true,
    schema: {
      ...base,
      properties: {
        ...base.properties,
        draft: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "slug",
            "title_hu",
            "category",
            "tags",
            "status",
            "content_status",
            "summary",
            "key_points",
            "related_pose_ids",
            "related_anatomy_ids",
            "ai_generated",
            "validated",
          ],
          properties: {
            id: { type: "string" },
            slug: { type: "string" },
            title_hu: { type: "string" },
            category: {
              type: "string",
              enum: ["breath", "alignment", "safety", "practice", "beginners", "recovery"],
            },
            tags: { type: "array", items: { type: "string" } },
            status: { type: "string", enum: ["draft", "active", "archived"] },
            content_status: { type: "string", enum: ["draft", "verified", "published", "archived"] },
            summary: { type: "string" },
            key_points: { type: "array", items: { type: "string" } },
            related_pose_ids: { type: "array", items: { type: "string" } },
            related_anatomy_ids: { type: "array", items: { type: "string" } },
            ai_generated: { type: "boolean" },
            validated: { type: "boolean" },
          },
        },
      },
    },
  };
}

function buildPosePrompt(payload: PosePayload, expectedSlug: string | null) {
  const poseList = KNOWN_POSES.map((pose) => `${pose.slug} | ${pose.name_hu} | ${pose.name_en}`).join("\n");
  const modeLine =
    payload.pose_mode === "known"
      ? `Known pose mode: use only the provided pose name. Do NOT switch to another pose.`
      : `Functional mode: choose one known, stable pose from the list below. Do NOT invent or hybridize poses.`;
  const userLine =
    payload.pose_mode === "known"
      ? `Pose input: "${payload.pose_name ?? payload.pose_slug ?? ""}". Expected slug: "${expectedSlug ?? ""}".`
      : `Functional goal input: "${payload.functional_goal ?? ""}".`;

  return `
You are generating a yoga Pose knowledge object in strict JSON only.
${modeLine}
${userLine}

Known poses list (slug | name_hu | name_en):
${poseList}

Hard rules:
- Output JSON only, no markdown.
- Never invent a fantasy pose.
- Keep language practical, yoga-focused, not medical, not marketing.
- Do not use these phrases: ${FORBIDDEN_PHRASES.join(", ")}.
- self_check_statements MUST be statements, not questions.
- Human-facing Hungarian text must include proper accents.
- Technical fields (slug/id/enums) must be ASCII canonical values.
- Less is more: pick only the most important items, do not be exhaustive.
- Do not repeat the same idea across multiple fields.
- attention_points = what the practitioner feels/observes.
- alignment_cues = what is physically adjusted.
- Avoid Latin muscle names; prefer common Hungarian terms.

Limits (max):
- purpose: 3
- attention_points: 4
- alignment_cues: 4
- self_check_statements: 5
- common_mistakes: 4
- stretches: 4
- strengthens: 4
- activates: 4
- relieves: 3
- contraindications: 3
- modifications: 5
- props: 5

Image prompt rules:
- mannequin_* prompts: short, view-specific; primary is angled, front is optional backup.
- Always include the line: "The mannequin must remain visually identical to the reference image in style, proportions, shading, and line work."

Return JSON with this shape:
{
  "entity_type": "pose",
  "draft": {
    "id": "pose_<slug>",
    "slug": "<slug>",
    "name_hu": "",
    "name_en": "",
    "sanskrit_name": null,
    "category": "standing | seated | supine | prone | kneeling | balance | twist | backbend | forward_fold | restorative",
    "level": "beginner | intermediate | advanced | all_levels",
    "tags": [],
    "status": "draft",
    "content_status": "draft",
    "content_status": "draft",
    "summary": "",
    "purpose": ["mobilizing | stretching | strengthening | stabilizing | restorative | grounding | energizing"],
    "setup": "",
    "entry": "",
    "hold": "",
    "exit": "",
    "breath": "",
    "duration": { "min_seconds": 0, "max_seconds": 0 },
    "attention_points": [],
    "alignment_cues": [],
    "self_check_statements": [],
    "common_mistakes": [],
    "stretches": [],
    "strengthens": [],
    "activates": [],
    "relieves": [],
    "body_regions": [],
    "contraindications": [],
    "caution_areas": [],
    "modifications": [],
    "props": [],
    "pain_notes": "",
    "anatomy_refs": [],
    "related_pose_ids": [],
    "mannequin_front": { "spec": null, "prompt": "", "asset_ref": null, "status": "missing" },
    "mannequin_angled": { "spec": null, "prompt": "", "asset_ref": null, "status": "missing" },
    "ai_generated": true,
    "ai_confidence": null,
    "validated": false,
    "validated_by": null
  },
  "confidence": {},
  "warnings": [],
  "uncertain_fields": [],
  "sources": []
}
  `.trim();
}

function buildAnatomyPrompt(payload: AnatomyPayload) {
  return `
You are generating an Anatomy knowledge object for yoga practice in strict JSON only.
Topic: "${payload.topic}"

Hard rules:
- Output JSON only, no markdown.
- Practical yoga anatomy, not a full atlas.
- Do not diagnose or make medical claims.
- Avoid marketing and spiritualized language.
- Do not use these phrases: ${FORBIDDEN_PHRASES.join(", ")}.
- Human-facing Hungarian text must include proper accents.
- Technical fields (slug/id/enums) must be ASCII canonical values.
- Less is more: pick only the most important items.
- Avoid Latin muscle names and technical jargon.
- description / role_in_movement / why_relevant_in_yoga: max 2-3 sentences each.

Limits (max):
- common_patterns: 4
- tension_patterns: 4
- weakness_patterns: 4
- awareness_cues: 4

Image prompt rule:
- scientific_image.prompt: region-only anatomy, desaturated surrounding structures, subtle highlight, minimal Latin labels, transparent background.

Return JSON with this shape:
{
  "entity_type": "anatomy",
  "draft": {
    "id": "anat_<slug>",
    "slug": "<slug>",
    "name_hu": "",
    "name_en": "",
    "name_latin": null,
    "region": "",
    "type": "muscle | joint | area | system",
    "tags": [],
    "status": "draft",
    "content_status": "draft",
    "description": "",
    "role_in_movement": "",
    "why_relevant_in_yoga": "",
    "common_patterns": [],
    "tension_patterns": [],
    "weakness_patterns": [],
    "stretch_pose_ids": [],
    "strengthen_pose_ids": [],
    "mobility_pose_ids": [],
    "caution_pose_ids": [],
    "awareness_cues": [],
    "discomfort_notes": "",
    "safe_practice_notes": "",
    "scientific_image": { "spec": null, "prompt": "", "asset_ref": null, "status": "missing" },
    "ai_generated": true,
    "validated": false
  },
  "confidence": {},
  "warnings": [],
  "uncertain_fields": [],
  "sources": []
}
  `.trim();
}

function buildKnowledgeCardPrompt(payload: KnowledgeCardPayload) {
  return `
You are generating a short, structured yoga KnowledgeCard in strict JSON only.
Topic: "${payload.topic}"

Hard rules:
- Output JSON only, no markdown.
- Keep it short and structured. Not a blog post.
- Avoid marketing language and medical claims.
- Do not use these phrases: ${FORBIDDEN_PHRASES.join(", ")}.
- Human-facing Hungarian text must include proper accents.
- Technical fields (slug/id/enums) must be ASCII canonical values.
- Less is more: keep key_points short and focused.

Return JSON with this shape:
{
  "entity_type": "knowledge_card",
  "draft": {
    "id": "card_<slug>",
    "slug": "<slug>",
    "title_hu": "",
    "category": "breath | alignment | safety | practice | beginners | recovery",
    "tags": [],
    "status": "draft",
    "summary": "",
    "key_points": [],
    "related_pose_ids": [],
    "related_anatomy_ids": [],
    "ai_generated": true,
    "validated": false
  },
  "confidence": {},
  "warnings": [],
  "uncertain_fields": [],
  "sources": []
}
  `.trim();
}

function injectIds(raw: any, entityType: Payload["entity_type"], expectedSlug?: string | null) {
  if (!raw?.draft) return raw;
  const slug = normalizeSlug(
    expectedSlug ?? raw.draft.slug ?? raw.draft.name_en ?? raw.draft.name_hu ?? raw.draft.title_hu ?? ""
  );
  if (!slug) return raw;
  raw.draft.slug = slug;
  if (entityType === "pose") raw.draft.id = createYogiId("pose", slug);
  if (entityType === "anatomy") raw.draft.id = createYogiId("anat", slug);
  if (entityType === "knowledge_card") raw.draft.id = createYogiId("card", slug);
  if (entityType === "pose") {
    const current = typeof raw.draft.sanskrit_name === "string" ? raw.draft.sanskrit_name.trim() : "";
    if (!current && slug in KNOWN_POSE_SANSKRIT) {
      raw.draft.sanskrit_name = KNOWN_POSE_SANSKRIT[slug];
    }
  }
  return raw;
}

function resolveKnownPoseSlug(payload: PosePayload) {
  if (payload.pose_slug) return normalizeSlug(payload.pose_slug);
  if (payload.pose_name) {
    const normalized = normalizeSlug(payload.pose_name);
    if (KNOWN_POSES.some((pose) => pose.slug === normalized)) return normalized;
    const byName = KNOWN_POSES.find(
      (pose) => normalizeSlug(pose.name_en) === normalized || normalizeSlug(pose.name_hu) === normalized
    );
    return byName?.slug ?? null;
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

  if (!payload?.entity_type) {
    return phaseError("request_parse", "MISSING_ENTITY_TYPE", "entity_type is required", 400);
  }

  if (payload.entity_type === "pose") {
    if (payload.pose_mode === "known" && !payload.pose_name && !payload.pose_slug) {
      return phaseError("request_parse", "MISSING_POSE_NAME", "pose_name or pose_slug is required", 400);
    }
    if (payload.pose_mode === "functional" && !payload.functional_goal) {
      return phaseError("request_parse", "MISSING_FUNCTIONAL_GOAL", "functional_goal is required", 400);
    }
  }

  const aiModel = process.env.YOGI_AI_MODEL;
  if (!aiModel) {
    return phaseError("request_parse", "MISSING_MODEL", "Missing YOGI_AI_MODEL env", 500);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let prompt = "";
  let expectedSlug: string | null = null;
  if (payload.entity_type === "pose") {
    expectedSlug = payload.pose_mode === "known" ? resolveKnownPoseSlug(payload) : null;
    if (payload.pose_mode === "known" && !expectedSlug) {
      return phaseError("request_parse", "UNKNOWN_POSE", "Unknown pose slug or name", 400);
    }
    prompt = buildPosePrompt(payload, expectedSlug);
  }
  if (payload.entity_type === "anatomy") prompt = buildAnatomyPrompt(payload);
  if (payload.entity_type === "knowledge_card") prompt = buildKnowledgeCardPrompt(payload);

  let responseText = "";
  let structuredAttempted = false;
  try {
    structuredAttempted = true;
    const responseFormat = buildResponseFormat(payload.entity_type);
    const response = await client.responses.create({
      model: aiModel,
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: responseFormat.name,
          strict: responseFormat.strict,
          schema: responseFormat.schema,
        },
      },
    });
    responseText = getOutputText(response);
  } catch (err) {
    if (!structuredAttempted) {
      return phaseError("draft_api", "DRAFT_API_ERROR", (err as Error)?.message ?? "Draft api failed", 502);
    }
    try {
      const response = await client.responses.create({
        model: aiModel,
        input: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });
      responseText = getOutputText(response);
    } catch (fallbackError) {
      return phaseError(
        "draft_api",
        "DRAFT_API_ERROR",
        (fallbackError as Error)?.message ?? "Draft api failed",
        502
      );
    }
  }

  let parsed: any;
  try {
    parsed = parseStrictJson(responseText);
  } catch (err) {
    return phaseError("draft_parse", "DRAFT_NOT_JSON", (err as Error)?.message ?? "Invalid JSON", 400);
  }

  parsed = injectIds(parsed, payload.entity_type, expectedSlug);

  const validated = YogiDraftResponseSchema.safeParse(parsed);
  if (!validated.success) {
    const detail = validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
    return phaseError("draft_schema", "DRAFT_SCHEMA_INVALID", detail, 400);
  }

  const draft = validated.data.draft;
  if (payload.entity_type === "pose") {
    const poseParsed = PoseSchema.safeParse(draft);
    if (!poseParsed.success) {
      const detail = poseParsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
      return phaseError("draft_schema", "POSE_SCHEMA_INVALID", detail, 400);
    }
    let slots = buildPoseImageSlots(poseParsed.data);
    const aiSpec = await generatePoseImageSpecAI(poseParsed.data);
    if (aiSpec?.spec) {
      slots = buildPoseImageSlotsWithSpec(poseParsed.data, aiSpec.spec);
    }
    const poseWithSlots: Pose = {
      ...poseParsed.data,
      status: "draft",
      content_status: poseParsed.data.content_status ?? "draft",
      mannequin_front: slots.mannequin_front,
      mannequin_angled: slots.mannequin_angled,
    };
    validated.data.draft = poseWithSlots;
    const imageCheck = validatePoseImageSlots({
      mannequin_front: poseWithSlots.mannequin_front,
      mannequin_angled: poseWithSlots.mannequin_angled,
    });
    if (imageCheck.hardErrors.length > 0) {
      return phaseError("image_prompt", "POSE_IMAGE_PROMPT_INVALID", imageCheck.hardErrors.join(" | "), 400);
    }
    const quality = validatePoseQuality(poseWithSlots, {
      poseMode: payload.pose_mode,
      expectedSlug: expectedSlug ?? undefined,
    });
    if (quality.hardErrors.length > 0) {
      return phaseError("quality_check", "POSE_HARD_REJECT", quality.hardErrors.join(" | "), 400);
    }
    const nextWarnings = [...validated.data.warnings, ...quality.warnings, ...imageCheck.warnings];
    if (aiSpec?.warning) nextWarnings.push(aiSpec.warning);
    validated.data.warnings = [...new Set(nextWarnings)];
  }

  if (payload.entity_type === "anatomy") {
    const anatomyParsed = AnatomySchema.safeParse(draft);
    if (!anatomyParsed.success) {
      const detail = anatomyParsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
      return phaseError("draft_schema", "ANATOMY_SCHEMA_INVALID", detail, 400);
    }
    const anatomyWithSlot: Anatomy = {
      ...anatomyParsed.data,
      status: "draft",
      content_status: anatomyParsed.data.content_status ?? "draft",
      scientific_image: buildAnatomyImageSlot(anatomyParsed.data),
    };
    validated.data.draft = anatomyWithSlot;
    const imageCheck = validateAnatomyImageSlot(anatomyWithSlot.scientific_image);
    if (imageCheck.hardErrors.length > 0) {
      return phaseError("image_prompt", "ANATOMY_IMAGE_PROMPT_INVALID", imageCheck.hardErrors.join(" | "), 400);
    }
    const quality = validateAnatomyQuality(anatomyWithSlot);
    if (quality.hardErrors.length > 0) {
      return phaseError("quality_check", "ANATOMY_HARD_REJECT", quality.hardErrors.join(" | "), 400);
    }
    validated.data.warnings = [
      ...new Set([...validated.data.warnings, ...quality.warnings, ...imageCheck.warnings]),
    ];
  }

  if (payload.entity_type === "knowledge_card") {
    const cardParsed = KnowledgeCardSchema.safeParse(draft);
    if (!cardParsed.success) {
      const detail = cardParsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
      return phaseError("draft_schema", "CARD_SCHEMA_INVALID", detail, 400);
    }
    const cardWithStatus = {
      ...cardParsed.data,
      status: "draft",
      content_status: cardParsed.data.content_status ?? "draft",
    };
    validated.data.draft = cardWithStatus;
    const quality = validateKnowledgeCardQuality(cardWithStatus);
    if (quality.hardErrors.length > 0) {
      return phaseError("quality_check", "CARD_HARD_REJECT", quality.hardErrors.join(" | "), 400);
    }
    validated.data.warnings = [...new Set([...validated.data.warnings, ...quality.warnings])];
  }

  return NextResponse.json(validated.data);
}
