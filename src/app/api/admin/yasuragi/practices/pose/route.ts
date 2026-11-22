/** Create a NEW, unapproved pose from an immutable Yasuragi authoring draft.
 * The existing generic Yogi save route can update records; this route deliberately cannot.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { PoseRevisionConflict } from "@/lib/yogiPoseConcurrency";
import { getYogiKnowledgeStore, normalizeSlug } from "@/lib/yogiKnowledgeStore";
import { PoseSchema } from "@/lib/yogiKnowledgeSchema";
import { validatePoseQuality } from "@/lib/yogiKnowledgeValidation";
import { readPracticeDraft } from "@/features/yasuragi/lib/practice-draft-store";
import { assessNewPoseDraft } from "@/features/yasuragi/lib/practice-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const DRAFT_ID = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;
const POSE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return respond({ error: "Másik eredetről nem engedélyezett." }, 403);
  if (Number(request.headers.get("content-length")) > 4096) return respond({ error: "Túl nagy kérés." }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4096) return respond({ error: "Túl nagy kérés." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return respond({ error: "Hibás kérés." }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return respond({ error: "Érvénytelen JSON." }, 400); }
  const { draftId, poseId, expectedSha256, confirm } = body;
  if (typeof draftId !== "string" || !DRAFT_ID.test(draftId) || typeof poseId !== "string" || !POSE_ID.test(poseId) ||
      typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256) || confirm !== true) {
    return respond({ error: "Hiányzó azonosító, ellenőrzőösszeg vagy megerősítés." }, 400);
  }
  try {
    const draft = await readPracticeDraft(draftId);
    if (!draft?.authoring) return respond({ error: "Nincs egységes, mentett authoring projekt." }, 404);
    if (draft.sha256 !== expectedSha256) return respond({ error: "A projektverzió megváltozott. Frissítsd az oldalt." }, 409);
    const proposal = draft.authoring.poseProposals.find((p) => p.poseId === poseId);
    if (!proposal) return respond({ error: "Ez a póz nem szerepel a mentett projekt javaslatai között." }, 404);
    const parsed = PoseSchema.safeParse(proposal.record);
    if (!parsed.success) return respond({ error: "A póztervezet nem felel meg az aktuális könyvtári sémának." }, 422);
    const record = parsed.data;
    const store = getYogiKnowledgeStore();
    const { poses, revision } = await store.readPoseSnapshot();
    const assessment = assessNewPoseDraft(poseId, record, poses, normalizeSlug);
    if (assessment === "unsafe_state") return respond({ error: "Csak képnélküli, jóváhagyatlan draft pózt lehet felvenni." }, 422);
    if (assessment === "collision") return respond({ error: "Ez a pózazonosító vagy slug már létezik. Nem írunk felül könyvtári rekordot." }, 409);
    const quality = validatePoseQuality(record);
    if (quality.hardErrors.length) return respond({ error: "A póztervezet szerkesztői hibás.", reasons: quality.hardErrors }, 422);
    // The CAS head commit is the durable success boundary. An immediate second
    // public-Blob read can still see a stale CDN response; do not turn a
    // successful write into a misleading 502 or an automatic retry.
    const savedRevision = await store.savePoses([...poses, { ...record, slug: normalizeSlug(record.slug) }], revision);
    return respond({ ok: true, poseId, status: "draft", revision: savedRevision, warnings: quality.warnings }, 201);
  } catch (cause) {
    if (cause instanceof PoseRevisionConflict) return respond({ error: cause.message, error_code: "POSE_REVISION_CONFLICT" }, 409);
    console.error("[Yasuragi P03] POSE_CREATE", process.env.NODE_ENV === "production" ? "failed" : cause);
    return respond({ error: "A póz létrehozása vagy ellenőrzése sikertelen. Előbb nézd meg az ászanatárat; ne ismételd automatikusan." }, 503);
  }
}
