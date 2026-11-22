import { NextResponse } from "next/server";
import { SpiritStatusEnum } from "@/lib/spiritSchema";
import { requireAdmin } from "@/lib/adminAuth";
import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import { privateShioriReady, updateShioriPrivateBlob } from "@/lib/shioriPrivateBlob";

export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const rejected = await requireAdmin(request);
  if (rejected) return rejected;
  if (!privateShioriReady()) return NextResponse.json({ error: "Privát tárolás még nem aktív." }, { status: 503, headers: HEADERS });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.bookId !== "string" || !payload.bookId ||
      (typeof payload.status === "undefined" && typeof payload.notes === "undefined")) {
    return NextResponse.json({ error: "Érvénytelen státuszkérés." }, { status: 400, headers: HEADERS });
  }
  const parsed = payload.status !== undefined ? SpiritStatusEnum.safeParse(payload.status) : null;
  if ((parsed && !parsed.success) || (payload.notes !== undefined && typeof payload.notes !== "string")) {
    return NextResponse.json({ error: "Érvénytelen státusz vagy jegyzet." }, { status: 400, headers: HEADERS });
  }
  try {
    const library = await loadSpiritLibrary();
    if (!library.books.some((book) => book.id === payload.bookId)) {
      return NextResponse.json({ error: "A könyv nem található." }, { status: 404, headers: HEADERS });
    }
    const saved = await updateShioriPrivateBlob((state) => {
      const books = { ...state.books };
      const current = { ...(books[payload.bookId] ?? {}) };
      if (parsed?.success) {
        if (parsed.data === "olvasatlan") delete current.status;
        else current.status = parsed.data;
      }
      if (payload.notes !== undefined) {
        const note = payload.notes.trim();
        if (note) current.notes = note;
        else delete current.notes;
      }
      if (Object.keys(current).length) books[payload.bookId] = current;
      else delete books[payload.bookId];
      return { ...state, books };
    });
    return NextResponse.json({ ok: true,
      status: saved.books[payload.bookId]?.status ?? "olvasatlan",
      notes: saved.books[payload.bookId]?.notes ?? "" }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "A privát mentés nem igazolható. Ellenőrizd az adatokat, ne ismételd automatikusan." }, { status: 503, headers: HEADERS });
  }
}
