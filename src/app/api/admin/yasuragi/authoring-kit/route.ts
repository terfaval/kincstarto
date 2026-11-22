import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { PoseSchema } from "@/lib/yogiKnowledgeSchema";
import { ALLOWED_PROPS } from "@/lib/yogiPropCatalog";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { buildYasuragiAuthoringKit } from "@/features/yasuragi/lib/practice-authoring-kit";

// Preserve the input-specific Zod overload instead of applying ReturnType to the
// overloaded z.toJSONSchema function (whose last overload is registry-based).
function exportPoseSchema() {
  return z.toJSONSchema(PoseSchema);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
function fail(code: string, message: string, status: number, cause: unknown) {
  // Keep source data, paths and credentials out of the browser response.
  if (process.env.NODE_ENV === "production") console.error(`[Yasuragi P04.1] ${code}`);
  else console.error(`[Yasuragi P04.1] ${code}`, cause);
  return NextResponse.json({ code, error: message }, { status, headers: PRIVATE });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  let poses: Awaited<ReturnType<ReturnType<typeof getYogiKnowledgeStore>["listPoses"]>>;
  try {
    poses = await getYogiKnowledgeStore().listPoses();
  } catch (cause) {
    return fail("YAS_P04_LIBRARY_READ", "Nem sikerült beolvasni az aktuális ászanatárat (YAS_P04_LIBRARY_READ).", 503, cause);
  }

  let kit: ReturnType<typeof buildYasuragiAuthoringKit>;
  try {
    kit = buildYasuragiAuthoringKit(poses, ALLOWED_PROPS, new Date().toISOString());
  } catch (cause) {
    return fail("YAS_P04_KIT_BUILD", "Az ászanakatalógus authoring-adatainak előállítása sikertelen (YAS_P04_KIT_BUILD).", 500, cause);
  }

  let poseSchema: ReturnType<typeof exportPoseSchema>;
  try {
    // Always export the real PoseSchema. Do not silently replace unsupported rules with `any`.
    poseSchema = exportPoseSchema();
  } catch (cause) {
    return fail("YAS_P04_POSE_SCHEMA", "Nem sikerült exportálni az ászanatár validációs sémáját (YAS_P04_POSE_SCHEMA).", 500, cause);
  }

  try {
    return NextResponse.json({ ...kit, poseSchema }, {
      headers: {
        ...PRIVATE,
        "Content-Disposition": 'attachment; filename="yasuragi-authoring-kit-v1.json"',
      },
    });
  } catch (cause) {
    return fail("YAS_P04_RESPONSE", "Az elkészült Authoring Kit JSON-válaszának összeállítása sikertelen (YAS_P04_RESPONSE).", 500, cause);
  }
}
