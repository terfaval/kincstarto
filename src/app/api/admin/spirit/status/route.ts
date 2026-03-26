import { NextResponse } from "next/server";
import { SpiritStatusEnum } from "@/lib/spiritSchema";
import { requireAdmin } from "@/lib/adminAuth";
import { loadSpiritLibrary, saveSpiritLibrary } from "@/lib/spiritLibrary";

export const runtime = "nodejs";

type Payload = {
  bookId: string;
  status?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasStatus = typeof payload.status !== "undefined";
  const hasNotes = typeof payload.notes !== "undefined";

  if (!payload.bookId || (!hasStatus && !hasNotes)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const statusParse = hasStatus ? SpiritStatusEnum.safeParse(payload.status) : null;
  if (hasStatus && !statusParse?.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (hasNotes && typeof payload.notes !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const library = await loadSpiritLibrary();

  const book = library.books.find((item) => item.id === payload.bookId);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  if (statusParse?.success) {
    book.status = statusParse.data;
  }

  if (typeof payload.notes !== "undefined") {
    const trimmed = payload.notes.trim();
    if (trimmed) {
      book.notes = trimmed;
    } else {
      delete book.notes;
    }
  }

  await saveSpiritLibrary(library);

  return NextResponse.json({ ok: true, status: book.status, notes: book.notes ?? "" });
}
