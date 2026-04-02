import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/adminAuth";
import { saveYogiImageAsset } from "@/lib/yogiImageStore";
import {
  validateAnatomyImageSlot,
  validateMannequinPrompt,
  ensureMannequinPrompt,
} from "@/lib/yogiImagePrompts";
import { normalizeSlug } from "@/lib/yogiKnowledgeStore";

export const runtime = "nodejs";

type Payload = {
  entity_type: "pose" | "anatomy";
  slot: "mannequin_front" | "mannequin_angled" | "scientific_image";
  prompt: string;
  review_instruction?: string;
  slug?: string;
};

function phaseError(phase: string, error_code: string, detail: string, status = 500) {
  return NextResponse.json({ error: "Image generation failed", phase, error_code, detail }, { status });
}

function normalizeSlot(slot: Payload["slot"]) {
  if (
    slot === "mannequin_front" ||
    slot === "mannequin_angled" ||
    slot === "scientific_image"
  ) {
    return slot;
  }
  return null;
}

function getViewType(slot: Payload["slot"]): "front" | "angled" | null {
  if (slot === "mannequin_front") return "front";
  if (slot === "mannequin_angled") return "angled";
  return null;
}

function getOutputText(response: any) {
  const direct = response?.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const items = Array.isArray(response?.output) ? response.output : [];
  for (const item of items) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
    const textPart = item.content.find(
      (part: any) => part?.type === "output_text" || part?.type === "text",
    );
    if (textPart?.text) return textPart.text as string;
  }
  return "";
}

async function revisePrompt(input: {
  client: OpenAI;
  model: string;
  prompt: string;
  instruction: string;
  entityType: Payload["entity_type"];
  viewType: "front" | "angled" | null;
}) {
  const systemRules =
    input.entityType === "pose"
      ? "Preserve all mannequin prompt blocks, camera/mat constraints, and negative rules. Keep block order and style instructions intact."
      : "Preserve all anatomy image constraints (region-only, desaturated surroundings, subtle highlight, minimal Latin labels, transparent background).";

  const response = await input.client.responses.create({
    model: input.model,
    input: [
      {
        role: "user",
        content: [
          "You edit an existing image prompt with minimal changes.",
          "Apply the instruction precisely and only where needed.",
          systemRules,
          input.viewType ? `View type: ${input.viewType}.` : "",
          "",
          "Return JSON with fields: revised_prompt, summary.",
          "",
          "Instruction:",
          input.instruction,
          "",
          "Current prompt:",
          input.prompt,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    text: {
      format: {
        name: "yogi_prompt_review_v1",
        type: "json_schema",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["revised_prompt", "summary"],
          properties: {
            revised_prompt: { type: "string" },
            summary: { type: "string" },
          },
        },
      },
    },
  });

  const text = getOutputText(response);
  const parsed = JSON.parse(text);
  return {
    revisedPrompt: String(parsed.revised_prompt ?? "").trim(),
    summary: String(parsed.summary ?? "").trim(),
  };
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

  if (!payload?.entity_type || !payload?.slot || !payload?.prompt) {
    return phaseError("request_parse", "MISSING_FIELDS", "entity_type, slot, and prompt are required", 400);
  }

  const slot = normalizeSlot(payload.slot);
  if (!slot) {
    return phaseError("request_parse", "INVALID_SLOT", "Unknown image slot", 400);
  }

  if (payload.entity_type === "pose" && slot === "scientific_image") {
    return phaseError("request_parse", "INVALID_SLOT", "Pose cannot use scientific_image", 400);
  }
  if (payload.entity_type === "anatomy" && slot !== "scientific_image") {
    return phaseError("request_parse", "INVALID_SLOT", "Anatomy must use scientific_image", 400);
  }

  const rawPrompt = payload.prompt.trim();
  if (!rawPrompt) {
    return phaseError("request_parse", "EMPTY_PROMPT", "Prompt must be non-empty", 400);
  }

  const viewType = getViewType(slot);
  const reviewInstruction = payload.review_instruction?.trim();
  let promptToUse = rawPrompt;
  let reviewSummary: string | null = null;

  if (reviewInstruction) {
    const reviewModel = process.env.YOGI_PROMPT_REVIEW_MODEL || process.env.YOGI_AI_MODEL;
    if (!reviewModel) {
      return phaseError(
        "image_prompt",
        "PROMPT_REVIEW_DISABLED",
        "Missing YOGI_PROMPT_REVIEW_MODEL (or YOGI_AI_MODEL).",
        400
      );
    }
    const { revisedPrompt, summary } = await revisePrompt({
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: reviewModel,
      prompt: rawPrompt,
      instruction: reviewInstruction,
      entityType: payload.entity_type,
      viewType,
    });
    if (!revisedPrompt) {
      return phaseError("image_prompt", "PROMPT_REVIEW_EMPTY", "Review returned empty prompt.", 400);
    }
    promptToUse = revisedPrompt;
    reviewSummary = summary || null;
  }

  const mannequinPrompt =
    payload.entity_type === "pose" && viewType
      ? ensureMannequinPrompt(promptToUse, viewType)
      : promptToUse;

  if (payload.entity_type === "pose") {
    const check = validateMannequinPrompt(mannequinPrompt, viewType ?? undefined);
    if (check.hardErrors.length > 0) {
      return phaseError("image_prompt", "POSE_IMAGE_PROMPT_INVALID", check.hardErrors.join(" | "), 400);
    }
  } else {
    const check = validateAnatomyImageSlot({ prompt: mannequinPrompt });
    if (check.hardErrors.length > 0) {
      return phaseError("image_prompt", "ANATOMY_IMAGE_PROMPT_INVALID", check.hardErrors.join(" | "), 400);
    }
  }

  const imageModel = process.env.YOGI_IMAGE_MODEL ?? "gpt-image-1";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const background = "transparent";
  const size = "1024x1024";
  const outputFormat = "png";
  const quality = "high";

  try {
    const result = await client.images.generate({
      model: imageModel,
      prompt: payload.entity_type === "pose" ? mannequinPrompt : rawPrompt,
      size,
      quality,
      background,
      output_format: outputFormat,
    });

    const item = result.data?.[0] as any;
    const b64 = item?.b64_json;
    const url = item?.url;

    if (!b64 && !url) {
      return phaseError("image_generate", "NO_IMAGE_DATA", "Image generation returned no data", 502);
    }

    if (url) {
      return NextResponse.json({
        ok: true,
        asset_ref: url,
        status: "generated",
        warning: undefined,
        warning_detail: undefined,
        prompt_used: mannequinPrompt,
        prompt_review: reviewSummary,
      });
    }

    const buffer = Buffer.from(b64, "base64");
    const slug = normalizeSlug(payload.slug ?? "unknown");
    const saved = await saveYogiImageAsset({
      slug,
      slot,
      format: outputFormat,
      buffer,
    });

    return NextResponse.json({
      ok: true,
      asset_ref: saved.url,
      status: "generated",
      warning: undefined,
      warning_detail: undefined,
      prompt_used: mannequinPrompt,
      prompt_review: reviewSummary,
    });
  } catch (err) {
    return phaseError("image_generate", "IMAGE_API_ERROR", (err as Error)?.message ?? "Image API failed", 502);
  }
}
