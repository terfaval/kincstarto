import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { ALLOWED_PROPS } from "@/lib/yogiPropCatalog";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { loadYasuragiPosePreviews } from "@/features/yasuragi/lib/practice-library";
import { readPracticeDraft } from "@/features/yasuragi/lib/practice-draft-store";
import { inspectAuthoringImport } from "@/features/yasuragi/lib/practice-authoring";
import { getProjectReview } from "@/features/yasuragi/lib/practice-review";
import { evaluatePublicationGate, attestationsComplete, reviewReceiptIsCurrent, type EditorialAttestations } from "@/features/yasuragi/lib/practice-publication";
import { digestReviewInput, latestReviewReceipt, listReviewReceipts, saveReviewReceipt } from "@/features/yasuragi/lib/practice-approval-store";
import { HistoryCursorError } from "@/features/yasuragi/lib/practice-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: PRIVATE });
const ID = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;
const SHA = /^[a-f0-9]{64}$/;

async function state(draftId: string) {
  const draft = await readPracticeDraft(draftId);
  if (!draft) return null;
  const [poses, library] = await Promise.all([loadYasuragiPosePreviews(), getYogiKnowledgeStore().listPoses()]);
  const { report } = inspectAuthoringImport(draft.authoring ?? draft.script, poses, ALLOWED_PROPS);
  const review = getProjectReview(draft.script, draft.authoring?.poseProposals ?? [], library);
  const gate = evaluatePublicationGate(draft.script, report, review);
  const librarySha256 = digestReviewInput(gate.libraryFingerprintInput);
  return { draft, gate, librarySha256 };
}

export async function GET(request: Request) {
  const denied = await requireAdmin(); if (denied) return denied;
  const draftId = new URL(request.url).searchParams.get("draft") ?? "";
  if (!ID.test(draftId)) return json({ error: "Érvénytelen tervezetazonosító." }, 400);
  try {
    if (new URL(request.url).searchParams.get("history") === "1") {
      const draft = await readPracticeDraft(draftId);
      if (!draft) return json({ error: "A tervezet nem található." }, 404);
      return json({ ok: true, ...await listReviewReceipts(draftId, new URL(request.url).searchParams.get("cursor")) });
    }
    const current = await state(draftId);
    if (!current) return json({ error: "A tervezet nem található." }, 404);
    const receipt = await latestReviewReceipt(draftId);
    const receiptCurrent = reviewReceiptIsCurrent(current.gate, receipt, current.draft.sha256, current.librarySha256);
    return json({ ok: true, gate: current.gate, librarySha256: current.librarySha256, receipt, receiptCurrent, publication: "not_publicly_activated" });
  } catch (cause) {
    if (cause instanceof HistoryCursorError) return json({ error: "Érvénytelen jóváhagyási előzménykurzor." }, 400);
    if (process.env.NODE_ENV !== "production") console.error("[Yasuragi P04] REVIEW_GET", cause);
    return json({ error: "A jóváhagyási állapot most nem olvasható." }, 503);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  if (Number(request.headers.get("content-length")) > 4096) return json({ error: "Túl nagy jóváhagyási kérés." }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4096) return json({ error: "Túl nagy jóváhagyási kérés." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Érvénytelen jóváhagyási kérés." }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "Érvénytelen JSON." }, 400); }
  if (body.action !== "signoff" || typeof body.draftId !== "string" || !ID.test(body.draftId) ||
      typeof body.expectedSha256 !== "string" || !SHA.test(body.expectedSha256) ||
      typeof body.expectedLibrarySha256 !== "string" || !SHA.test(body.expectedLibrarySha256) ||
      !body.attestations || typeof body.attestations !== "object" || Array.isArray(body.attestations)) return json({ error: "Hiányzó vagy hibás jóváhagyási adatok." }, 400);
  const attestations = body.attestations as EditorialAttestations;
  if (!attestationsComplete(attestations)) return json({ error: "Mindhárom kézi ellenőrzési nyilatkozat szükséges." }, 422);
  try {
    const current = await state(body.draftId);
    if (!current) return json({ error: "A tervezet nem található." }, 404);
    if (current.draft.sha256 !== body.expectedSha256 || current.librarySha256 !== body.expectedLibrarySha256) return json({ error: "Az előnézet óta megváltozott a tervezet vagy az élő ászanatár. Frissítsd az ellenőrzést." }, 409);
    if (!current.gate.eligible) return json({ error: "A publikálási kapu még nem teljesült; nem rögzíthető jóváhagyás.", gate: current.gate }, 422);
    const receipt = await saveReviewReceipt(body.draftId, current.draft.sha256, current.librarySha256, attestations);
    return json({ ok: true, receipt, publication: "not_publicly_activated" }, 201);
  } catch (cause) {
    if (process.env.NODE_ENV !== "production") console.error("[Yasuragi P04] REVIEW_SAVE", cause);
    return json({ error: "A jóváhagyás mentése nem igazolható. Ellenőrizd a naplót; ne ismételd automatikusan." }, 503);
  }
}
