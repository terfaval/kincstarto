import { NextResponse } from "next/server";
import { SpiritDraftSchema } from "@/lib/spiritDraftSchema";
import { SpiritBookSchema } from "@/lib/spiritSchema";
import { buildTagLabel } from "@/lib/spiritTags";
import { requireAdmin } from "@/lib/adminAuth";
import { loadSpiritLibrary, saveSpiritLibrary } from "@/lib/spiritLibrary";

export const runtime = "nodejs";

const FORBIDDEN = ["TBD", "TODO", "..."];
const SLUG_RE = /^[a-z0-9_]+$/;

function normalizeKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "_")
    .toLowerCase();
}

function hasForbidden(value?: string | null) {
  if (!value) return false;
  return FORBIDDEN.some((token) => value.includes(token));
}

function normalizeDraft(draft: any) {
  const cleaned = { ...draft };
  if (!cleaned.year) delete cleaned.year;
  if (Array.isArray(cleaned.prerequisites) && cleaned.prerequisites.length === 0) delete cleaned.prerequisites;
  if (Array.isArray(cleaned.related) && cleaned.related.length === 0) delete cleaned.related;
  if (Array.isArray(cleaned.tags) && cleaned.tags.length === 0) delete cleaned.tags;
  if (!cleaned.notes) delete cleaned.notes;
  if (!cleaned.summary_long) delete cleaned.summary_long;
  if (!cleaned.cautions) delete cleaned.cautions;
  return cleaned;
}

function normalizeBook(book: any) {
  const cleaned = { ...book };
  if (!cleaned.year) delete cleaned.year;
  if (Array.isArray(cleaned.prerequisites) && cleaned.prerequisites.length === 0) delete cleaned.prerequisites;
  if (Array.isArray(cleaned.related) && cleaned.related.length === 0) delete cleaned.related;
  if (Array.isArray(cleaned.tags) && cleaned.tags.length === 0) delete cleaned.tags;
  if (!cleaned.notes) delete cleaned.notes;
  if (!cleaned.summary_long) delete cleaned.summary_long;
  if (!cleaned.cautions) delete cleaned.cautions;
  return cleaned;
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const payload = await request.json().catch(() => null);
  if (!payload?.draft && !payload?.book) {
    return NextResponse.json({ error: "Missing draft or book" }, { status: 400 });
  }

  const isJsonBook = Boolean(payload?.book);
  const parsed = isJsonBook
    ? SpiritBookSchema.safeParse(payload.book)
    : SpiritDraftSchema.safeParse(payload.draft);

  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
    return NextResponse.json({ error: "Invalid book payload", detail }, { status: 400 });
  }

  const book = parsed.data;

  if (!SLUG_RE.test(book.id)) {
    return NextResponse.json({ error: "Invalid ASCII slug" }, { status: 400 });
  }
  if (!isJsonBook && book.status !== "olvasatlan") {
    return NextResponse.json({ error: "Status must be olvasatlan" }, { status: 400 });
  }
  if (book.year && !/^\d{4}$/.test(book.year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  if (
    hasForbidden(book.summary_short) ||
    hasForbidden(book.summary_long) ||
    hasForbidden(book.recommendation) ||
    hasForbidden(book.cautions)
  ) {
    return NextResponse.json({ error: "Forbidden placeholder text" }, { status: 400 });
  }

  const library = await loadSpiritLibrary();

  const normalizedTitle = normalizeKey(book.title);
  const normalizedAuthor = normalizeKey(book.author);
  const slugFromTitle = slugify(book.title);

  if (library.books.some((item) => item.id === book.id)) {
    return NextResponse.json({ error: "Duplicate book id" }, { status: 400 });
  }
  if (library.books.some((item) => item.id === slugFromTitle)) {
    return NextResponse.json({ error: "Duplicate slug" }, { status: 400 });
  }
  if (
    library.books.some(
      (item) =>
        normalizeKey(item.title) === normalizedTitle &&
        normalizeKey(item.author) === normalizedAuthor
    )
  ) {
    return NextResponse.json({ error: "Duplicate title + author" }, { status: 400 });
  }
  if (
    library.books.some((item) => {
      const bookAuthor = normalizeKey(item.author);
      if (bookAuthor !== normalizedAuthor) return false;
      const bookTitle = normalizeKey(item.title);
      return bookTitle.includes(normalizedTitle) || normalizedTitle.includes(bookTitle);
    })
  ) {
    return NextResponse.json({ error: "Possible duplicate by title/author" }, { status: 409 });
  }

  const pillSet = new Set(library.thematic_pills.map((pill) => pill.slug));
  const bookSet = new Set(library.books.map((book) => book.id));

  for (const theme of book.themes) {
    if (!pillSet.has(theme)) {
      return NextResponse.json({ error: `Unknown theme: ${theme}` }, { status: 400 });
    }
  }

  for (const rel of book.related ?? []) {
    if (!bookSet.has(rel)) {
      return NextResponse.json({ error: `Unknown related id: ${rel}` }, { status: 400 });
    }
  }

  const cleaned = isJsonBook ? normalizeBook(book) : normalizeDraft(book);
  library.books.push(cleaned);
  if (book.tags && book.tags.length > 0) {
    if (!library.tag_labels) library.tag_labels = {};
    book.tags.forEach((tag) => {
      if (!library.tag_labels) return;
      if (!library.tag_labels[tag]) {
        library.tag_labels[tag] = buildTagLabel(tag);
      }
    });
  }

  await saveSpiritLibrary(library);

  return NextResponse.json({ ok: true, id: book.id });
}
