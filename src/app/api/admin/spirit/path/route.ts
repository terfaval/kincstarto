import { NextResponse } from "next/server";
import { SpiritPathSchema } from "@/lib/spiritSchema";
import { requireAdmin } from "@/lib/adminAuth";
import { loadSpiritLibrary, saveSpiritLibrary } from "@/lib/spiritLibrary";

export const runtime = "nodejs";

type PathPayload = {
  path?: unknown;
  pathId?: string;
  progress?: number;
  title?: string;
  description?: string;
  delete?: boolean;
  itemComment?: { bookId?: string; comment?: string };
};

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let payload: PathPayload;
  try {
    payload = (await request.json()) as PathPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const library = await loadSpiritLibrary();

  if (payload.path) {
    const pathParse = SpiritPathSchema.safeParse(payload.path);
    if (!pathParse.success) {
      return NextResponse.json({ error: "Invalid path payload" }, { status: 400 });
    }
    const incoming = pathParse.data;
    const existingIndex = (library.paths ?? []).findIndex((path) => path.id === incoming.id);
    if (!library.paths) library.paths = [];
    if (existingIndex >= 0) {
      library.paths[existingIndex] = incoming;
    } else {
      library.paths.unshift(incoming);
    }
    await saveSpiritLibrary(library);
    return NextResponse.json({ ok: true });
  }

  if (!payload.pathId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (payload.delete) {
    library.paths = (library.paths ?? []).filter((item) => item.id !== payload.pathId);
    await saveSpiritLibrary(library);
    return NextResponse.json({ ok: true });
  }

  const path = (library.paths ?? []).find((item) => item.id === payload.pathId);
  if (!path) {
    return NextResponse.json({ error: "Path not found" }, { status: 404 });
  }

  if (typeof payload.title === "string") {
    const trimmed = payload.title.trim();
    if (trimmed) path.title = trimmed;
  }

  if (typeof payload.description === "string") {
    const trimmed = payload.description.trim();
    if (trimmed) path.description = trimmed;
    else delete path.description;
  }

  if (typeof payload.progress === "number" && Number.isFinite(payload.progress)) {
    path.progress = Math.max(0, Math.min(100, Math.round(payload.progress)));
  }

  if (payload.itemComment && payload.itemComment.bookId) {
    const bookId = payload.itemComment.bookId;
    const items = path.items ?? path.book_ids?.map((id) => ({ book_id: id })) ?? [];
    const updatedItems = items.map((item) => {
      if (item.book_id !== bookId) return item;
      const trimmed = payload.itemComment?.comment?.trim() ?? "";
      return trimmed ? { ...item, comment: trimmed } : { book_id: item.book_id };
    });
    path.items = updatedItems;
  }

  await saveSpiritLibrary(library);
  return NextResponse.json({ ok: true });
}
