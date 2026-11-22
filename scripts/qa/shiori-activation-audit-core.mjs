/** One-time, read-only activation audit. No Blob SDK calls or persistence. */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const digest = (raw) => createHash('sha256').update(raw).digest('hex');
const comparable = (value) => JSON.parse(JSON.stringify(value));

/** Checks the post-redaction 94/8 public catalog against the independently stored private state. */
export function auditShioriActivation(publicRaw, privateState, helpers) {
  if (typeof publicRaw !== 'string' || !publicRaw) throw new Error('Missing public bytes');
  const raw = JSON.parse(publicRaw);
  if (helpers.hasPersonal(raw)) throw new Error('Personal fields remain in public JSON');
  const library = helpers.validateLibrary(raw);
  const state = helpers.validateState(privateState);
  if (library.books.length !== 94 || (library.paths?.length ?? 0) !== 8) {
    throw new Error('Public catalog shape changed');
  }
  // Exact bytes, order, and editorial fields must equal the approved projection format.
  // Reject unknown schema fields, missing editorial fields and extraneous data.
  if (helpers.publicJson(library) !== publicRaw) {
    throw new Error('Public JSON is not the canonical published projection');
  }
  const bookIds = new Set(library.books.map((book) => book.id));
  const pathIds = new Set((library.paths ?? []).map((path) => path.id));
  if (bookIds.size !== 94 || pathIds.size !== 8) throw new Error('Duplicate IDs');
  for (const id of Object.keys(state.books)) {
    if (!bookIds.has(id)) throw new Error('Orphan private book');
  }
  for (const [id, item] of Object.entries(state.paths)) {
    if (!pathIds.has(id)) throw new Error('Orphan private path');
    const path = library.paths.find((entry) => entry.id === id);
    const ids = new Set(path.items?.map((entry) => entry.book_id) ?? path.book_ids ?? []);
    if (Object.keys(item.comments ?? {}).some((bookId) => !ids.has(bookId))) {
      throw new Error('Orphan private path comment');
    }
  }
  const statuses = Object.values(state.books).filter((book) => book.status && book.status !== 'olvasatlan').length;
  const notes = Object.values(state.books).filter((book) => Boolean(book.notes)).length;
  const progress = Object.values(state.paths).filter((path) => path.progress !== undefined).length;
  const comments = Object.values(state.paths).reduce((n, path) => n + Object.keys(path.comments ?? {}).length, 0);
  if (statuses !== 22 || notes !== 10 || progress !== 8 || comments !== 0) {
    throw new Error('Private migration inventory changed');
  }
  const merged = helpers.merge(library, state);
  // A lossless roundtrip must recover every private value without ever re-publishing it.
  if (!isDeepStrictEqual(comparable(helpers.extract(merged)), comparable(state)) ||
      helpers.publicJson(merged) !== publicRaw) {
    throw new Error('Private/public roundtrip mismatch');
  }
  return {
    books: 94, paths: 8, statuses: 22, adminEditorialNotes: 10,
    pathProgress: 8, pathComments: 0,
    publicSha256: digest(publicRaw),
    postcheckPassed: true,
  };
}
