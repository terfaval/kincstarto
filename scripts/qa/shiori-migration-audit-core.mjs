/**
 * SHIORI-05C/1. Pure, read-only audit of the proposed split.
 * No persistence, token access, or user-content logging is permitted here.
 * NOTE: this is NOT a migration authorization. Ownership of legacy reading
 * statuses and the meaning of legacy `notes` require separate approval.
 */
import { isDeepStrictEqual } from "node:util";
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Lossless structural redaction of the RAW source, before Zod can strip unknown keys. */
function redactRawForComparison(raw) {
  if (!isRecord(raw) || !Array.isArray(raw.books) ||
      (raw.paths !== undefined && !Array.isArray(raw.paths))) {
    throw new Error("Invalid raw catalog shape");
  }
  const clone = JSON.parse(JSON.stringify(raw));
  for (const book of clone.books) {
    if (!isRecord(book)) throw new Error("Invalid raw book shape");
    delete book.status;
    delete book.notes;
  }
  for (const path of (clone.paths ?? [])) {
    if (!isRecord(path)) throw new Error("Invalid raw path shape");
    delete path.progress;
    if (path.items !== undefined) {
      if (!Array.isArray(path.items)) throw new Error("Invalid raw path items");
      for (const item of path.items) {
        if (!isRecord(item)) throw new Error("Invalid raw path item");
        delete item.comment;
      }
    }
  }
  return clone;
}

export function auditShioriMigrationData(raw, parsed, ops) {
  const { extractShioriPrivateState, mergeShioriPrivateState, publicShioriHasPersonalFields, publicShioriJson, validateShioriPrivateState } = ops;
  if (!isRecord(raw) || !Array.isArray(raw.books) ||
      (raw.paths !== undefined && !Array.isArray(raw.paths))) {
    throw new Error("Invalid catalog structure");
  }
  const sourceBooks = raw.books;
  const sourcePaths = raw.paths ?? [];
  if (!sourceBooks.every(isRecord) || !sourcePaths.every(isRecord)) {
    throw new Error("Unexpected catalog record");
  }
  if (sourceBooks.length !== parsed.books.length || sourcePaths.length !== (parsed.paths?.length ?? 0)) {
    throw new Error("Catalog count changed during validation");
  }
  const state = validateShioriPrivateState(extractShioriPrivateState(parsed));
  const sanitized = JSON.parse(publicShioriJson(parsed));
  if (publicShioriHasPersonalFields(sanitized)) {
    throw new Error("Sanitized catalog still includes personal fields");
  }
  // Every non-private raw field must survive the exact schema/serialization path.
  const editorialProjectionLossless = isDeepStrictEqual(redactRawForComparison(raw), sanitized);

  const merged = mergeShioriPrivateState(parsed, state);
  const privateRoundtripLossless = isDeepStrictEqual(
    parsed.books.map((b) => [b.id, b.status, b.notes]),
    merged.books.map((b) => [b.id, b.status, b.notes]),
  ) && isDeepStrictEqual(
    (parsed.paths ?? []).map((p) => [p.id, p.progress,
      (p.items ?? []).map((i) => [i.book_id, i.comment])]),
    (merged.paths ?? []).map((p) => [p.id, p.progress,
      (p.items ?? []).map((i) => [i.book_id, i.comment])]),
  );

  // Count from RAW fields, not schema defaults. Do not return IDs or note content.
  let pathComments = 0;
  for (const path of sourcePaths) {
    const items = path.items;
    if (items === undefined) continue;
    if (!Array.isArray(items) || !items.every(isRecord)) throw new Error("Unexpected path items");
    pathComments += items.filter((i) => Object.hasOwn(i, "comment") && i.comment !== undefined).length;
  }
  const booksWithNotes = sourceBooks.filter((b) => Object.hasOwn(b, "notes") && b.notes !== undefined).length;
  return {
    books: parsed.books.length,
    paths: parsed.paths?.length ?? 0,
    nonDefaultStatuses: sourceBooks.filter((b) => Object.hasOwn(b, "status") &&
      b.status !== "olvasatlan" && b.status !== undefined).length,
    booksWithNotes,
    pathsWithProgress: sourcePaths.filter((p) => Object.hasOwn(p, "progress") && p.progress !== undefined).length,
    pathComments,
    editorialProjectionLossless,
    privateRoundtripLossless,
    ambiguousLegacyNotes: booksWithNotes > 0,
    // Legacy values do not identify the owner; only an explicit decision can do that.
    ownershipReviewRequired: true,
    eligibleForAutomaticMigration: false,
  };
}
