import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { z } from "zod";
import { buildPoseImageSpec } from "@/lib/yogiImageSpecs";
import { buildPoseImageSlotsWithSpec } from "@/lib/yogiImagePrompts";
import { generatePoseImageSpecAI } from "@/lib/yogiImageSpecAI";

export const runtime = "nodejs";

type Payload = {
  pose?: unknown;
};

function phaseError(phase: string, error_code: string, detail: string, status = 500) {
  return NextResponse.json({ error: "Spec generation failed", phase, error_code, detail }, { status });
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

  if (!payload?.pose) {
    return phaseError("request_parse", "MISSING_POSE", "pose is required", 400);
  }

  const PoseSpecInputSchema = z.object({
    name_en: z.string().min(1),
    name_hu: z.string().min(1),
    slug: z.string().min(1),
    setup: z.string().min(1),
    entry: z.string().min(1),
    hold: z.string().min(1),
  });

  const parsed = PoseSpecInputSchema.safeParse(payload.pose);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
    return phaseError("request_parse", "POSE_SCHEMA_INVALID", detail, 400);
  }

  const pose = parsed.data;
  const aiSpec = await generatePoseImageSpecAI(pose);
  const spec = aiSpec?.spec ?? buildPoseImageSpec(pose as any);
  const slots = buildPoseImageSlotsWithSpec(pose as any, spec);

  return NextResponse.json({
    ok: true,
    spec,
    slots,
    warning: aiSpec?.warning ?? null,
    warning_detail: aiSpec?.warning_detail ?? null,
  });
}
