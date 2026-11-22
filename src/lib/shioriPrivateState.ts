import type { SpiritLibrary, SpiritStatus } from "./spiritSchema";

/** Admin-only reading state and internal editorial notes; never export via a public route. */
export type ShioriPrivateState = {
  version: 1;
  books: Record<string, { status?: SpiritStatus; notes?: string }>;
  paths: Record<string, { progress?: number; comments?: Record<string, string> }>;
};

const PERSONAL_BOOK_FIELDS = ["status", "notes"] as const;

export function extractShioriPrivateState(library: SpiritLibrary): ShioriPrivateState {
  const state: ShioriPrivateState = { version: 1, books: {}, paths: {} };
  for (const book of library.books) {
    const item: ShioriPrivateState["books"][string] = {};
    if (book.status && book.status !== "olvasatlan") item.status = book.status;
    if (book.notes) item.notes = book.notes;
    if (Object.keys(item).length) state.books[book.id] = item;
  }
  for (const path of library.paths ?? []) {
    const item: ShioriPrivateState["paths"][string] = {};
    if (path.progress !== undefined) item.progress = path.progress;
    const comments = Object.fromEntries((path.items ?? [])
      .filter((entry) => Boolean(entry.comment))
      .map((entry) => [entry.book_id, entry.comment!])) as Record<string, string>;
    if (Object.keys(comments).length) item.comments = comments;
    if (Object.keys(item).length) state.paths[path.id] = item;
  }
  return state;
}

/** This JSON is safe to publish only after private state has been durably written and verified. */
export function publicShioriJson(library: SpiritLibrary): string {
  const sanitized = {
    ...library,
    books: library.books.map((book) => {
      const { status: _status, notes: _notes, ...editorial } = book;
      return editorial;
    }),
    paths: library.paths?.map((path) => {
      const { progress: _progress, ...editorial } = path;
      return {
        ...editorial,
        items: path.items?.map(({ comment: _comment, ...item }) => item),
      };
    }),
  };
  return `${JSON.stringify(sanitized, null, 2)}\n`;
}

export function publicShioriHasPersonalFields(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return true;
  const source = raw as Record<string, unknown>;
  if (!Array.isArray(source.books) || (source.paths !== undefined && !Array.isArray(source.paths))) return true;
  return source.books.some((value) => value && typeof value === "object" &&
    PERSONAL_BOOK_FIELDS.some((key) => Object.hasOwn(value, key))) ||
    ((source.paths as unknown[] | undefined) ?? []).some((value) => value && typeof value === "object" && (
      Object.hasOwn(value, "progress") ||
      (Array.isArray((value as { items?: unknown }).items) &&
        (value as { items: unknown[] }).items.some((entry) => entry && typeof entry === "object" && Object.hasOwn(entry, "comment")))));
}

export function validateShioriPrivateState(raw: unknown): ShioriPrivateState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid private state");
  const data = raw as Record<string, unknown>;
  if (data.version !== 1 || !data.books || !data.paths || typeof data.books !== "object" || typeof data.paths !== "object" ||
    Array.isArray(data.books) || Array.isArray(data.paths)) throw new Error("Invalid private state schema");
  const books: ShioriPrivateState["books"] = Object.create(null);
  const paths: ShioriPrivateState["paths"] = Object.create(null);
  const validStatus = new Set(["olvasatlan", "folyamatban", "befejezett", "referencia"]);
  for (const [id, rawItem] of Object.entries(data.books as Record<string, unknown>)) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem) || !id || id.length > 160) throw new Error("Invalid private book");
    const item = rawItem as Record<string, unknown>;
    if (Object.keys(item).some((key) => key !== "status" && key !== "notes") ||
      (item.status !== undefined && !validStatus.has(item.status as string)) ||
      (item.notes !== undefined && (typeof item.notes !== "string" || !item.notes.trim()))) throw new Error("Invalid private book fields");
    books[id] = { ...(item.status ? { status: item.status as SpiritStatus } : {}),
      ...(item.notes ? { notes: item.notes as string } : {}) };
  }
  for (const [id, rawItem] of Object.entries(data.paths as Record<string, unknown>)) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem) || !id) throw new Error("Invalid private path");
    const item = rawItem as Record<string, unknown>;
    if (Object.keys(item).some((key) => key !== "progress" && key !== "comments") ||
      (item.progress !== undefined && (typeof item.progress !== "number" || !Number.isFinite(item.progress) || item.progress < 0 || item.progress > 100))) throw new Error("Invalid private path progress");
    const comments: Record<string, string> = Object.create(null);
    if (item.comments !== undefined) {
      if (!item.comments || typeof item.comments !== "object" || Array.isArray(item.comments)) throw new Error("Invalid private comments");
      for (const [key, val] of Object.entries(item.comments)) {
        if (!key || typeof val !== "string" || !val.trim()) throw new Error("Invalid private comment");
        comments[key] = val;
      }
    }
    paths[id] = { ...(item.progress !== undefined ? { progress: item.progress as number } : {}),
      ...(Object.keys(comments).length ? { comments } : {}) };
  }
  if (Object.keys(data).some((key) => !["version", "books", "paths"].includes(key))) throw new Error("Unknown private state fields");
  return { version: 1, books, paths };
}

export function mergeShioriPrivateState(publicLibrary: SpiritLibrary, state: ShioriPrivateState): SpiritLibrary {
  return {
    ...publicLibrary,
    books: publicLibrary.books.map((book) => {
      const privateBook = state.books[book.id];
      return {
        ...book,
        status: privateBook?.status ?? "olvasatlan",
        ...(privateBook?.notes ? { notes: privateBook.notes } : {}),
      };
    }),
    paths: publicLibrary.paths?.map((path) => {
      const privatePath = state.paths[path.id];
      return {
        ...path,
        ...(privatePath?.progress !== undefined ? { progress: privatePath.progress } : {}),
        items: path.items?.map((entry) => ({ ...entry,
          ...(privatePath?.comments?.[entry.book_id] ? { comment: privatePath.comments[entry.book_id] } : {}) })),
      };
    }),
  };
}
