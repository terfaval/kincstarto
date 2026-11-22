import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { ALLOWED_PROPS } from "@/lib/yogiPropCatalog";
import { loadYasuragiPosePreviews } from "@/features/yasuragi/lib/practice-library";
import { YASURAGI_MAX_IMPORT_BYTES } from "@/features/yasuragi/lib/practice-import";
import { inspectAuthoringImport } from "@/features/yasuragi/lib/practice-authoring";
import { listPracticeDrafts, readPracticeDraft, savePracticeDraft } from "@/features/yasuragi/lib/practice-draft-store";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { getProjectReview } from "@/features/yasuragi/lib/practice-review";
import { HistoryCursorError } from "@/features/yasuragi/lib/practice-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: PRIVATE });

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const draftId = new URL(request.url).searchParams.get("draft");
    if (draftId) {
      if (!/^[0-9]{13}-[0-9a-f-]{36}\.json$/.test(draftId)) return json({ error: "Érvénytelen tervezetazonosító." }, 400);
      const draft = await readPracticeDraft(draftId);
      if (!draft) return json({ error: "A tervezet nem található." }, 404);
      const poses = await loadYasuragiPosePreviews();
      const { report } = inspectAuthoringImport(draft.authoring ?? draft.script, poses, ALLOWED_PROPS);
      const review = getProjectReview(draft.script, draft.authoring?.poseProposals ?? [], await getYogiKnowledgeStore().listPoses());
      return json({ ok: true, draft, report, review });
    }
    const cursor = new URL(request.url).searchParams.get("cursor");
    return json({ ok: true, ...await listPracticeDrafts(cursor) });
  } catch (cause) {
    if (cause instanceof HistoryCursorError) return json({ error: "Érvénytelen tervezetlista-lapozási kurzor." }, 400);
    return json({ error: "A privát Yasuragi tervezetlista most nem olvasható. Ellenőrizd a privát tároló konfigurációját." }, 503);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  if (Number(request.headers.get("content-length")) > YASURAGI_MAX_IMPORT_BYTES) return json({ error: "A JSON-kérés túl nagy (maximum 600 KB)." }, 413);
  let requestBody: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > YASURAGI_MAX_IMPORT_BYTES) return json({ error: "A JSON-kérés túl nagy (maximum 600 KB)." }, 413);
    requestBody = JSON.parse(raw);
  } catch { return json({ error: "Érvénytelen JSON-kérés." }, 400); }
  if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) return json({ error: "Hiányzó importkérés." }, 400);
  const payload = requestBody as Record<string, unknown>;
  if (payload.action !== "preview" && payload.action !== "save") return json({ error: "Csak preview és save művelet engedélyezett." }, 400);
  // Preview reads the pose library but does not access the private draft store.
  // Keep failures separate: the old catch misreported all validation errors as storage outages.
  let poses: Awaited<ReturnType<typeof loadYasuragiPosePreviews>>;
  try {
    poses = await loadYasuragiPosePreviews();
  } catch (cause) {
    logDiagnostic("POSE_LIBRARY_READ", cause);
    return json({ code: "YAS_P02_POSE_LIBRARY", error: "Nem sikerült betölteni az ászanatárat (YAS_P02_POSE_LIBRARY). A JSON ellenőrzése még nem indult el." }, 503);
  }

  let inspected: ReturnType<typeof inspectAuthoringImport>;
  try {
    inspected = inspectAuthoringImport(payload.source, poses, ALLOWED_PROPS);
  } catch (cause) {
    logDiagnostic("IMPORT_VALIDATION_EXCEPTION", cause);
    return json({ code: "YAS_P02_VALIDATOR", error: "Váratlan hiba az authoring JSON ellenőrzésekor (YAS_P02_VALIDATOR). Nézd meg a fejlesztői terminál naplóját." }, 500);
  }
  const { script, authoring, report } = inspected;
  if (payload.action === "preview") return json({ ok: report.ok, report });
  if (!report.ok || !script) return json({ ok: false, report, error: "A tervezet hibás. Mentés nem történt." }, 422);
  try {
    const saved = await savePracticeDraft(script, authoring);
    return json({ ok: true, report, draftId: saved.draftId, sha256: saved.sha256, createdAt: saved.createdAt }, 201);
  } catch (cause) {
    logDiagnostic("PRIVATE_DRAFT_SAVE", cause);
    const message = cause instanceof Error ? cause.message : "";
    if (message.includes("Ne ismételd automatikusan") || message.includes("ne ismételd automatikusan")) {
      return json({ code: "YAS_P02_SAVE_UNCERTAIN", error: "A mentés állapota bizonytalan. Ellenőrizd a tervezetlistát, ne próbáld meg automatikusan újra." }, 502);
    }
    return json({ code: "YAS_P02_DRAFT_STORE", error: "A privát tervezettárolóba nem sikerült menteni (YAS_P02_DRAFT_STORE)." }, 503);
  }
}

/** Internal developer diagnostics. Never echo exception text or secrets to the browser. */
function logDiagnostic(phase: string, cause: unknown): void {
  // Diagnostic labels stay visible in production logs; exception details only in local dev.
  if (process.env.NODE_ENV === "production") {
    console.error(`[Yasuragi P02] ${phase}`);
  } else {
    console.error(`[Yasuragi P02] ${phase}`, cause);
  }
}
