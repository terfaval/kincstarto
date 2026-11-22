import type { SpiritBook } from "./spiritSchema";

/** Only editorially declared related IDs are eligible; never infer new links. */
export function explicitShioriRelated(book: SpiritBook, allBooks: readonly SpiritBook[]): SpiritBook[] {
  if (!book.related?.length) return [];
  const byId = new Map(allBooks.map((item) => [item.id, item]));
  const seen = new Set<string>();
  return book.related.flatMap((id) => {
    if (id === book.id || seen.has(id)) return [];
    const related = byId.get(id);
    if (!related) return [];
    seen.add(id);
    return [related];
  }).slice(0, 4);
}
