/** P05d: bounded, forward-only cursors. No public catalogue reads private history. */
export const HISTORY_PAGE_SIZE = 30;
const MAX_CURSOR_LENGTH = 2048;

export type HistoryPage<T> = { items: T[]; nextCursor: string | null; hasMore: boolean };
export class HistoryCursorError extends Error {
  constructor() { super("Érvénytelen előzménykurzor."); this.name = "HistoryCursorError"; }
}

export function blobHistoryCursor(cursor: string | null | undefined): string | undefined {
  if (cursor == null || cursor === "") return undefined;
  if (!cursor.startsWith("blob:") || cursor.length > MAX_CURSOR_LENGTH || /[\x00-\x1f\x7f]/.test(cursor)) {
    throw new HistoryCursorError();
  }
  const inner = cursor.slice(5);
  if (!inner) throw new HistoryCursorError();
  return inner;
}

export function localHistoryCursor(cursor: string | null | undefined, idPattern: RegExp): string | undefined {
  if (cursor == null || cursor === "") return undefined;
  if (!cursor.startsWith("local:") || cursor.length > MAX_CURSOR_LENGTH || !idPattern.test(cursor.slice(6))) {
    throw new HistoryCursorError();
  }
  return cursor.slice(6);
}

export function localHistoryPage(ids: string[], afterId: string | undefined, limit = HISTORY_PAGE_SIZE): HistoryPage<string> {
  const eligible = ids.filter((id) => !afterId || id > afterId).sort();
  const page = eligible.slice(0, limit);
  const hasMore = eligible.length > limit;
  return { items: page, hasMore, nextCursor: hasMore ? `local:${page[page.length - 1]}` : null };
}

export function nextBlobHistoryCursor(hasMore: boolean, cursor?: string): string | null {
  if (!hasMore) return null;
  if (!cursor || cursor.length > MAX_CURSOR_LENGTH - 5) throw new Error("A Blob előzménylapozási válasza hiányos.");
  return `blob:${cursor}`;
}
