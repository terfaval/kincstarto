import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import { SpiritPathSchema, validateSpiritLibrary } from "@/lib/spiritSchema";
import { readSpiritJsonBlob, writeSpiritJsonBlob } from "@/lib/spiritJsonBlob";
import { privateShioriReady, updateShioriPrivateBlob } from "@/lib/shioriPrivateBlob";

export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const rejected = await requireAdmin(request);
  if (rejected) return rejected;
  if (!privateShioriReady()) return NextResponse.json({ error: "Privát tárolás még nem aktív." }, { status: 503, headers: HEADERS });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Érvénytelen útvonalkérés." }, { status: 400, headers: HEADERS });
  }
  if (payload.delete) return NextResponse.json({ error: "Az útvonal törlése a privát állapot leválasztása után külön jóváhagyást igényel." },
    { status: 410, headers: HEADERS });
  const editorialOperation = payload.path !== undefined || payload.title !== undefined || payload.description !== undefined;
  const privateOperation = payload.progress !== undefined || payload.itemComment !== undefined;
  if ((editorialOperation && privateOperation && payload.path === undefined) ||
      (payload.path && (payload.title !== undefined || payload.description !== undefined || payload.itemComment !== undefined))) {
    return NextResponse.json({ error: "A privát és szerkesztői mezők nem menthetők egyetlen műveletben." }, { status: 400, headers: HEADERS });
  }
  if (editorialOperation) {
    try {
      const live = await readSpiritJsonBlob();
      const candidate = structuredClone(live.library);
      if (payload.path) {
        const parsed = SpiritPathSchema.safeParse(payload.path);
        if (!parsed.success || (parsed.data.progress !== undefined && parsed.data.progress !== 0) ||
            parsed.data.items?.some((item) => item.comment)) {
          return NextResponse.json({ error: "Új út csak szerkesztői adatokkal menthető. Személyes mezőket külön ments." }, { status: 400, headers: HEADERS });
        }
        const path = { ...parsed.data };
        delete path.progress;
        if (!candidate.paths) candidate.paths = [];
        if (candidate.paths.some((item) => item.id === path.id)) return NextResponse.json({ error: "Létező útazonosító." }, { status: 409, headers: HEADERS });
        candidate.paths.unshift(path);
      } else {
        const path = candidate.paths?.find((item) => item.id === payload.pathId);
        if (!path) return NextResponse.json({ error: "Olvasási út nem található." }, { status: 404, headers: HEADERS });
        if (payload.title !== undefined) {
          if (typeof payload.title !== "string" || !payload.title.trim()) return NextResponse.json({ error: "Az út címe kötelező." }, { status: 400, headers: HEADERS });
          path.title = payload.title.trim();
        }
        if (payload.description !== undefined) {
          if (typeof payload.description !== "string") return NextResponse.json({ error: "Érvénytelen útleírás." }, { status: 400, headers: HEADERS });
          if (payload.description.trim()) path.description = payload.description.trim();
          else delete path.description;
        }
      }
      validateSpiritLibrary(candidate);
      await writeSpiritJsonBlob(live, candidate);
      return NextResponse.json({ ok: true }, { headers: HEADERS });
    } catch {
      return NextResponse.json({ error: "Az útvonal éles módosítása nem igazolható. Frissítsd a nézetet; ne ismételd automatikusan." }, { status: 503, headers: HEADERS });
    }
  }
  if (typeof payload.pathId !== "string" || !payload.pathId ||
      (!privateOperation) ||
      (payload.progress !== undefined && (!Number.isFinite(payload.progress) || payload.progress < 0 || payload.progress > 100)) ||
      (payload.itemComment !== undefined && (typeof payload.itemComment.bookId !== "string" || typeof payload.itemComment.comment !== "string"))) {
    return NextResponse.json({ error: "Érvénytelen privát útvonaladat." }, { status: 400, headers: HEADERS });
  }
  try {
    const library = await loadSpiritLibrary();
    const path = library.paths?.find((item) => item.id === payload.pathId);
    if (!path) return NextResponse.json({ error: "Olvasási út nem található." }, { status: 404, headers: HEADERS });
    if (payload.itemComment && !((path.items?.map((item) => item.book_id) ?? path.book_ids ?? []).includes(payload.itemComment.bookId))) {
      return NextResponse.json({ error: "A könyv nem része az olvasási útnak." }, { status: 400, headers: HEADERS });
    }
    await updateShioriPrivateBlob((state) => {
      const paths = { ...state.paths };
      const next = { ...(paths[payload.pathId] ?? {}) };
      if (payload.progress !== undefined) next.progress = payload.progress;
      if (payload.itemComment) {
        const comments = { ...(next.comments ?? {}) };
        const trimmed = payload.itemComment.comment.trim();
        if (trimmed) comments[payload.itemComment.bookId] = trimmed;
        else delete comments[payload.itemComment.bookId];
        if (Object.keys(comments).length) next.comments = comments;
        else delete next.comments;
      }
      if (Object.keys(next).length) paths[payload.pathId] = next;
      else delete paths[payload.pathId];
      return { ...state, paths };
    });
    return NextResponse.json({ ok: true }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "A privát mentés kimenetele nem igazolható. Ne ismételd automatikusan." }, { status: 503, headers: HEADERS });
  }
}
