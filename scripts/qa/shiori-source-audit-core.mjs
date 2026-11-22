import { createHash } from 'node:crypto';

const PERSONAL_BOOK_FIELDS = new Set(['status', 'notes']);
const PERSONAL_PATH_FIELDS = new Set(['progress']);

function unique(values) {
  return new Set(values).size === values.length;
}

function asArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}: expected array`);
  return value;
}

function idsOf(list, label) {
  const ids = asArray(list, label).map((row) => {
    if (!row || typeof row.id !== 'string' || !row.id.trim()) {
      throw new Error(`Invalid ${label}: missing id`);
    }
    return row.id;
  });
  if (!unique(ids)) throw new Error(`Invalid ${label}: duplicate ids`);
  return ids;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function publicBookFields(book) {
  return Object.fromEntries(Object.entries(book).filter(([name]) => !PERSONAL_BOOK_FIELDS.has(name)));
}

function publicPathFields(path) {
  const fields = Object.fromEntries(Object.entries(path).filter(([name]) => !PERSONAL_PATH_FIELDS.has(name)));
  if (Array.isArray(fields.items)) {
    fields.items = fields.items.map(({ comment: _comment, ...item }) => item);
  }
  return fields;
}

/** Validates only the editorial references; never prints a personal field value. */
export function summarizeShioriSource(library, label = 'source') {
  if (!library || typeof library !== 'object') throw new Error(`${label}: invalid library`);
  const books = asArray(library.books, `${label}.books`);
  const paths = asArray(library.paths ?? [], `${label}.paths`);
  const pills = asArray(library.thematic_pills, `${label}.thematic_pills`);
  const bookIds = idsOf(books, `${label}.books`);
  const pathIds = idsOf(paths, `${label}.paths`);
  const themes = pills.map((pill) => pill.slug);
  if (!unique(themes)) throw new Error(`${label}: duplicate theme slugs`);
  const bookSet = new Set(bookIds);
  const themeSet = new Set(themes);
  const tagLabels = library.tag_labels ?? {};
  const problems = [];
  const missingTagLabels = new Set();
  let relatedReferences = 0;
  let pathReferences = 0;
  for (const book of books) {
    for (const theme of asArray(book.themes, `book ${book.id}.themes`)) {
      if (!themeSet.has(theme)) problems.push(`Missing theme for book ${book.id}: ${theme}`);
    }
    for (const id of book.related ?? []) {
      relatedReferences++;
      if (!bookSet.has(id)) problems.push(`Missing related book id ${id} in ${book.id}`);
    }
    for (const tag of book.tags ?? []) {
      if (!Object.hasOwn(tagLabels, tag)) missingTagLabels.add(tag);
    }
  }
  for (const path of paths) {
    const refs = path.items?.map((item) => item.book_id) ?? path.book_ids ?? [];
    for (const id of refs) {
      pathReferences++;
      if (!bookSet.has(id)) problems.push(`Missing book id ${id} in path ${path.id}`);
    }
  }
  const privateCounts = {
    booksWithNonDefaultStatus: books.filter((book) => book.status && book.status !== 'olvasatlan').length,
    booksWithNotes: books.filter((book) => typeof book.notes === 'string' && book.notes.trim()).length,
    pathsWithProgress: paths.filter((path) => Object.hasOwn(path, 'progress')).length,
    pathItemsWithComments: paths.reduce((sum, path) => sum + (path.items ?? []).filter((item) => Object.hasOwn(item, 'comment')).length, 0),
  };
  return {
    label,
    fingerprint: digest(library), // Fingerprint only; never include personal data in reports.
    bookCount: bookIds.length,
    pathCount: pathIds.length,
    themeCount: themes.length,
    tagLabelCount: Object.keys(tagLabels).length,
    relatedReferences,
    pathReferences,
    missingTagLabelCount: missingTagLabels.size,
    bookIds,
    pathIds,
    privateCounts,
    errors: problems,
  };
}

export function compareShioriSources(left, right) {
  const a = summarizeShioriSource(left, 'baseline');
  const b = summarizeShioriSource(right, 'candidate');
  const aBooks = new Map(left.books.map((book) => [book.id, book]));
  const bBooks = new Map(right.books.map((book) => [book.id, book]));
  const commonIds = a.bookIds.filter((id) => bBooks.has(id));
  const changedPublicFields = {};
  for (const id of commonIds) {
    const original = publicBookFields(aBooks.get(id));
    const updated = publicBookFields(bBooks.get(id));
    const fields = new Set([...Object.keys(original), ...Object.keys(updated)]);
    for (const field of fields) {
      if (JSON.stringify(original[field]) !== JSON.stringify(updated[field])) {
        changedPublicFields[field] = (changedPublicFields[field] ?? 0) + 1;
      }
    }
  }
  const originalPaths = new Map(left.paths?.map((path) => [path.id, path]) ?? []);
  const candidatePaths = new Map(right.paths?.map((path) => [path.id, path]) ?? []);
  const changedEditorialPaths = a.pathIds.filter((id) => candidatePaths.has(id) &&
    JSON.stringify(publicPathFields(originalPaths.get(id))) !== JSON.stringify(publicPathFields(candidatePaths.get(id))));
  return {
    baseline: { fingerprint: a.fingerprint, books: a.bookCount, paths: a.pathCount },
    candidate: { fingerprint: b.fingerprint, books: b.bookCount, paths: b.pathCount },
    addedBookIds: b.bookIds.filter((id) => !aBooks.has(id)),
    missingBookIds: a.bookIds.filter((id) => !bBooks.has(id)),
    addedPathIds: b.pathIds.filter((id) => !originalPaths.has(id)),
    missingPathIds: a.pathIds.filter((id) => !candidatePaths.has(id)),
    changedPublicFields,
    changedEditorialPathCount: changedEditorialPaths.length,
  };
}

export function auditShelfMap(library, map) {
  const shelves = asArray(map?.shelves, 'shelf map');
  const ids = idsOf(shelves, 'shelves');
  const bookIds = shelves.flatMap((shelf) => asArray(shelf.bookIds, `shelf ${shelf.id}`));
  const libraryIds = new Set(idsOf(library.books, 'library books'));
  const mapped = new Set(bookIds);
  const errors = [];
  if (ids.length !== 7) errors.push(`Expected 7 shelves, found ${ids.length}`);
  if (!unique(bookIds)) errors.push('Duplicate shelf book assignments');
  for (const shelf of shelves) {
    if (shelf.featured && !shelf.bookIds.includes(shelf.featured)) errors.push(`Invalid featured id in shelf ${shelf.id}`);
  }
  return {
    shelfCount: ids.length,
    mappedIds: bookIds.length,
    booksWithoutShelf: [...libraryIds].filter((id) => !mapped.has(id)),
    configuredBooksMissingFromSource: [...mapped].filter((id) => !libraryIds.has(id)),
    errors,
  };
}
