import type { SpiritBook, SpiritLibrary } from "./spiritSchema";

export type SpiritJsonImportMode = "add" | "upsert";

export type SpiritJsonImportSummary = {
  received: number;
  added: string[];
  updated: { id: string; fields: string[]; relatedBefore?: string[]; relatedAfter?: string[] }[];
  unchanged: number;
  skippedExisting: number;
  ignoredPersonalFields: number;
};

export class SpiritJsonImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpiritJsonImportError";
  }
}

// An imported document only controls explicitly supplied editorial book fields.
// Keep the historic personal fields in the live store, even when importing a
// full export containing status and notes for every book.
const EDITORIAL_FIELDS = [
  "title", "author", "author_sort_key", "author_display_short",
  "primary_category_id", "cover_family", "spine_family", "cover_tag_ids",
  "tradition", "level", "summary_short", "summary_long", "recommendation",
  "themes", "language", "format", "prerequisites", "cautions",
  "tags", "year", "related",
] as const satisfies readonly (keyof SpiritBook)[];
const OPTIONAL_FIELDS = new Set<string>([
  "author_sort_key", "author_display_short", "primary_category_id",
  "cover_family", "spine_family", "cover_tag_ids", "summary_long",
  "prerequisites", "cautions", "tags", "year", "related",
]);
const ALLOWED_FIELDS = new Set<string>(["id", "status", "notes", ...EDITORIAL_FIELDS]);
const SLUG_RE = /^[a-z0-9_]+$/;

type JsonRecord = Record<string, unknown>;
function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function extractImportedBooks(source: unknown): JsonRecord[] {
  let books: unknown;
  if (Array.isArray(source)) books = source;
  else if (isRecord(source) && Array.isArray(source.books)) books = source.books;
  else if (isRecord(source) && isRecord(source.book)) books = [source.book];
  else if (isRecord(source) && typeof source.id === "string") books = [source];
  else throw new SpiritJsonImportError("Várható formátum: egy könyv, könyvtömb vagy teljes könyvtár-JSON (books).");

  if (!Array.isArray(books) || books.length < 1 || books.length > 500) {
    throw new SpiritJsonImportError("Az import 1–500 könyvobjektumot fogadhat.");
  }
  for (const book of books) {
    if (!isRecord(book) || typeof book.id !== "string" || !book.id.trim() || book.id.length > 160) {
      throw new SpiritJsonImportError("Minden könyvhöz meglévő, nem üres id szükséges.");
    }
    for (const key of Object.keys(book)) {
      if (!ALLOWED_FIELDS.has(key)) {
        throw new SpiritJsonImportError(`Nem támogatott könyvmező: ${book.id}.${key}`);
      }
    }
  }
  const ids = books.map((book: JsonRecord) => book.id);
  if (new Set(ids).size !== ids.length) {
    throw new SpiritJsonImportError("Az import ismétlődő könyvazonosítót tartalmaz.");
  }
  return books as JsonRecord[];
}

export function planSpiritJsonImport(current: SpiritLibrary, source: unknown, mode: SpiritJsonImportMode) {
  if (mode !== "add" && mode !== "upsert") throw new SpiritJsonImportError("Ismeretlen importmód.");
  const incoming = extractImportedBooks(source);
  const candidate: SpiritLibrary = {
    ...current,
    books: current.books.map((book) => ({ ...book })),
  };
  const index = new Map(candidate.books.map((book, i) => [book.id, i]));
  const summary: SpiritJsonImportSummary = {
    received: incoming.length, added: [], updated: [], unchanged: 0,
    skippedExisting: 0, ignoredPersonalFields: 0,
  };

  for (const row of incoming) {
    const id = row.id as string;
    const existingIndex = index.get(id);
    if (Object.hasOwn(row, "status")) summary.ignoredPersonalFields++;
    if (Object.hasOwn(row, "notes")) summary.ignoredPersonalFields++;
    if (existingIndex !== undefined && mode === "add") {
      summary.skippedExisting++;
      continue;
    }
    if (existingIndex === undefined && !SLUG_RE.test(id)) {
      throw new SpiritJsonImportError(`Az új könyv azonosítója csak ASCII slug lehet: ${id}`);
    }
    const oldBook = existingIndex === undefined ? null : candidate.books[existingIndex];
    const next: JsonRecord = oldBook ? { ...oldBook } : { id, status: "olvasatlan" };
    const changedFields: string[] = [];
    for (const field of EDITORIAL_FIELDS) {
      if (!Object.hasOwn(row, field)) continue;
      const value = row[field];
      if (value === null) {
        if (!OPTIONAL_FIELDS.has(field)) {
          throw new SpiritJsonImportError(`A kötelező mező nem törölhető: ${id}.${field}`);
        }
        if (Object.hasOwn(next, field)) {
          delete next[field];
          changedFields.push(field);
        }
      } else if (!same(next[field], value)) {
        next[field] = value;
        changedFields.push(field);
      }
    }
    if (oldBook) {
      // Protect the live personal data even when a full exported JSON is edited.
      next.status = oldBook.status;
      if (oldBook.notes === undefined) delete next.notes;
      else next.notes = oldBook.notes;
      if (changedFields.length === 0) summary.unchanged++;
      else {
        candidate.books[existingIndex!] = next as unknown as SpiritBook;
        summary.updated.push({
          id, fields: changedFields,
          ...(changedFields.includes("related") ? {
            relatedBefore: oldBook.related ?? [], relatedAfter: (next.related as string[] | undefined) ?? [],
          } : {}),
        });
      }
    } else {
      candidate.books.push(next as unknown as SpiritBook);
      index.set(id, candidate.books.length - 1);
      summary.added.push(id);
    }
  }
  // Path records, themes, version and tag label metadata are never replaced by
  // a book import. A full export is safe to re-import for editorial book edits.
  return { candidate, summary };
}
