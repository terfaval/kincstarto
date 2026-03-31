import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { z } from "zod";
import { buildPoseImageSpec, isPoseImageSpecLikelyUseful } from "@/lib/yogiImageSpecs";
import { buildPoseImageSlotsWithSpec } from "@/lib/yogiImagePrompts";
import { generatePoseImageSpecAI } from "@/lib/yogiImageSpecAI";
import resolvePoseImageSpecFromLibrary from "@/lib/yogiPoseImageSpecLibrary";

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
    name_en: z.string().optional().default(""),
    name_hu: z.string().optional().default(""),
    slug: z.string().optional().default(""),
    setup: z.string().optional().default(""),
    entry: z.string().optional().default(""),
    hold: z.string().optional().default(""),
  });

  const parsed = PoseSpecInputSchema.safeParse(payload.pose);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
    return phaseError("request_parse", "POSE_SCHEMA_INVALID", detail, 400);
  }

  const pose = parsed.data;
  const library = resolvePoseImageSpecFromLibrary(pose);

  let spec = "";
  let specSource: "library" | "heuristic" | "ai" | null = null;
  let matchedPoseId: string | null = null;
  let matchedVariationId: string | null = null;
  let warning: string | null = null;
  let warningDetail: string | null = null;

  if (library?.spec) {
    spec = library.spec;
    specSource = "library";
    matchedPoseId = library.poseId ?? null;
    matchedVariationId = library.variationId ?? null;
  } else {
    const heuristicSpec = buildPoseImageSpec(pose as any);

    if (heuristicSpec && isPoseImageSpecLikelyUseful(heuristicSpec)) {
      spec = heuristicSpec;
      specSource = "heuristic";
    } else {
      const aiSpec = await generatePoseImageSpecAI(pose);

      if (aiSpec?.spec) {
        spec = aiSpec.spec;
        specSource = "ai";
        warning = aiSpec.warning ?? null;
        warningDetail = aiSpec.warning_detail ?? null;
      } else if (heuristicSpec) {
        spec = heuristicSpec;
        specSource = "heuristic";
        warning = "heuristic_spec_used_after_ai_failure";
        warningDetail = aiSpec?.warning_detail ?? null;
      }
    }
  }

  if (!spec) {
    return phaseError(
      "spec_generate",
      "SPEC_RESOLUTION_FAILED",
      "Unable to resolve pose image spec from library, heuristic, or AI",
      500,
    );
  }

  const slots = buildPoseImageSlotsWithSpec(
    pose as any,
    spec,
    library?.compiledPrompt ?? null,
    library?.visibilityConstraints ?? null,
    library?.negativeConstraints ?? null,
  );

  return NextResponse.json({
    ok: true,
    spec,
    spec_source: specSource,
    matched_pose_id: matchedPoseId,
    matched_variation_id: matchedVariationId,
    slots,
    warning,
    warning_detail: warningDetail,
  });
}
