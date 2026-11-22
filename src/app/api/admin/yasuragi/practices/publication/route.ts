import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { ALLOWED_PROPS } from "@/lib/yogiPropCatalog";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { buildYasuragiPosePreviews } from "@/features/yasuragi/lib/practice-library";
import { readPracticeDraft } from "@/features/yasuragi/lib/practice-draft-store";
import { getProjectReview } from "@/features/yasuragi/lib/practice-review";
import { inspectAuthoringImport } from "@/features/yasuragi/lib/practice-authoring";
import { evaluatePublicationGate, requiredPublicationPoses, reviewReceiptIsCurrent } from "@/features/yasuragi/lib/practice-publication";
import { digestReviewInput, latestReviewReceipt } from "@/features/yasuragi/lib/practice-approval-store";
import { readCurrentPublicPractice } from "@/features/yasuragi/lib/practice-public-read";
import { publishPractice, readPublicationStatus, revokePractice } from "@/features/yasuragi/lib/practice-release-store";
import { preparePublicPosePreviews } from "@/features/yasuragi/lib/practice-public-image";
import { PublicationConflict, PUBLICATION_ID, RELEASE_ID } from "@/features/yasuragi/lib/practice-release-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: HEADERS });
const DRAFT = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;
const SHA = /^[a-f0-9]{64}$/;

async function candidate(draftId: string) {
  const draft = await readPracticeDraft(draftId);
  if (!draft) return null;
  // One library read for gate and frozen release: avoid mixing independent pose snapshots.
  const library = await getYogiKnowledgeStore().listPoses();
  const poses = buildYasuragiPosePreviews(library, draft.script);
  const { report } = inspectAuthoringImport(draft.authoring ?? draft.script, poses, ALLOWED_PROPS);
  const review = getProjectReview(draft.script, draft.authoring?.poseProposals ?? [], library);
  const gate = evaluatePublicationGate(draft.script, report, review);
  return { draft, poses, gate, librarySha256: digestReviewInput(gate.libraryFingerprintInput) };
}

export async function GET(request: Request) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = new URL(request.url).searchParams.get("practiceId") ?? "";
  if (!PUBLICATION_ID.test(id)) return json({ error: "Érvénytelen gyakorlásazonosító." }, 400);
  try {
    const state = await readPublicationStatus(id);
    const publiclyAccessible = state.status === "published" && Boolean(await readCurrentPublicPractice(id));
    return json({ ok: true, ...state, publiclyAccessible });
  }
  catch { return json({ error: "A kiadási állapot nem olvasható." }, 503); }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  if (Number(request.headers.get("content-length")) > 4096) return json({ error: "Túl nagy kiadási kérés." }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4096) return json({ error: "Túl nagy kiadási kérés." }, 413);
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Érvénytelen kiadási kérés." }, 400);
    body = value as Record<string, unknown>;
  } catch { return json({ error: "Érvénytelen JSON." }, 400); }
  if (body.action === "revoke") {
    if (typeof body.practiceId !== "string" || !PUBLICATION_ID.test(body.practiceId) ||
        typeof body.expectedReleaseId !== "string" || !RELEASE_ID.test(body.expectedReleaseId)) return json({ error: "Hibás visszavonási adatok." }, 400);
    try {
      await revokePractice(body.practiceId, body.expectedReleaseId);
      return json({ ok: true, status: "revoked", practiceId: body.practiceId });
    } catch (cause) {
      if (cause instanceof PublicationConflict) return json({ error: cause.message }, 409);
      return json({ error: "A visszavonás nem igazolható. Ellenőrizd az aktuális állapotot; ne ismételd automatikusan." }, 503);
    }
  }
  if (body.action !== "publish" || typeof body.draftId !== "string" || !DRAFT.test(body.draftId) ||
      typeof body.expectedSha256 !== "string" || !SHA.test(body.expectedSha256) ||
      typeof body.expectedLibrarySha256 !== "string" || !SHA.test(body.expectedLibrarySha256)) {
    return json({ error: "Hiányzó vagy hibás publikálási adatok." }, 400);
  }
  try {
    const current = await candidate(body.draftId);
    if (!current) return json({ error: "A tervezet nem található." }, 404);
    if (current.draft.sha256 !== body.expectedSha256 || current.librarySha256 !== body.expectedLibrarySha256) {
      return json({ error: "A tervezet vagy a pózkönyvtár megváltozott. Frissítsd a jóváhagyási ellenőrzést." }, 409);
    }
    const receipt = await latestReviewReceipt(body.draftId);
    if (!reviewReceiptIsCurrent(current.gate, receipt, current.draft.sha256, current.librarySha256)) {
      return json({ error: "Nincs érvényes szerkesztői és szakmai jóváhagyás ehhez a verzióhoz." }, 422);
    }
    const publicPoses = preparePublicPosePreviews(current.poses, requiredPublicationPoses(current.draft.script));
    const release = await publishPractice({ script: current.draft.script, poses: publicPoses, librarySha256: current.librarySha256 });
    return json({ ok: true, status: "published", releaseId: release.releaseId, practiceId: release.practiceId }, 201);
  } catch (cause) {
    if (cause instanceof PublicationConflict) return json({ error: cause.message }, 409);
    if (process.env.NODE_ENV !== "production") console.error("[Yasuragi P06] PUBLICATION", cause);
    return json({ error: "A kiadás állapota nem igazolható. Ellenőrizd a kiadáslistát; ne ismételd automatikusan." }, 503);
  }
}
