import type { SpiritBook, SpiritLibrary } from "./spiritSchema";

export function orderShioriBooks(books: readonly SpiritBook[]): SpiritBook[] {
  return [...books].sort((left, right) => {
    const a = left.author_sort_key?.trim() || left.author;
    const b = right.author_sort_key?.trim() || right.author;
    return a.localeCompare(b, "hu", { sensitivity: "base" }) ||
      left.title.localeCompare(right.title, "hu", { sensitivity: "base" }) ||
      left.id.localeCompare(right.id, "hu");
  });
}

/**
 * The legacy JSON combines public bibliography with personal progress.
 * Keep historical values in storage, never in public client payloads.
 * The placeholder required by the legacy schema must not be displayed.
 */
export function publicShioriCatalog(library: SpiritLibrary): SpiritLibrary {
  return {
    ...library,
    books: library.books.map(({ status: _status, notes: _notes, ...book }) => ({
      ...book,
      status: "olvasatlan" as const,
    })),
    paths: library.paths?.map(({ progress: _progress, ...path }) => ({
      ...path,
      items: path.items?.map(({ comment: _comment, ...item }) => item),
    })),
  };
}
