/** Pure Shiori conservative merge. No network and no file writes. */
export function makeShioriRecoveryCandidate(live, reference) {
  const unique = (values) => [...new Set(values)];
  function records(source, property, key) {
    if (!Array.isArray(source?.[property])) throw new Error(`Missing ${property} array in ${key}`);
    const map = new Map();
    for (const item of source[property]) {
      const id = property === 'thematic_pills' ? item?.slug : item?.id;
      if (typeof id !== 'string' || !id.trim() || map.has(id)) {
        throw new Error(`Missing/duplicate id in ${key}.${property}`);
      }
      map.set(id, item);
    }
    return map;
  }
  if (!live || !reference || live.library_version !== reference.library_version) {
    throw new Error('Library versions missing or different; manual resolution is required.');
  }
  const liveBooks = records(live, 'books', 'live');
  const refBooks = records(reference, 'books', 'reference');
  const livePaths = records(live, 'paths', 'live');
  const refPaths = records(reference, 'paths', 'reference');
  const livePills = records(live, 'thematic_pills', 'live');
  const refPills = records(reference, 'thematic_pills', 'reference');
  const additions = [];
  const relatedExpanded = [];
  const commonEditorialDifferences = {};
  const books = [...liveBooks.values()].map((book) => {
    const ref = refBooks.get(book.id);
    if (!ref) return structuredClone(book);
    for (const field of unique([...Object.keys(book), ...Object.keys(ref)])) {
      if (['status', 'notes', 'related'].includes(field)) continue;
      if (JSON.stringify(book[field]) !== JSON.stringify(ref[field])) {
        commonEditorialDifferences[field] = (commonEditorialDifferences[field] || 0) + 1;
      }
    }
    const former = book.related || [];
    const newRelated = unique([...former, ...(ref.related || [])]);
    if (newRelated.length !== former.length) relatedExpanded.push(book.id);
    const merged = structuredClone(book);
    if (newRelated.length) merged.related = newRelated;
    return merged;
  });
  for (const [id, book] of refBooks) {
    if (!liveBooks.has(id)) {
      additions.push(id);
      books.push(structuredClone(book));
    }
  }
  const newPaths = [];
  const paths = [...livePaths.values()].map((path) => structuredClone(path));
  const commonPathsWithEditorialDifferences = [];
  for (const [id, path] of refPaths) {
    if (!livePaths.has(id)) {
      paths.push(structuredClone(path));
      newPaths.push(id);
    } else {
      const scrub = (p) => {
        const { progress: _progress, ...rest } = p;
        if (rest.items) rest.items = rest.items.map(({ comment: _comment, ...item }) => item);
        return rest;
      };
      if (JSON.stringify(scrub(livePaths.get(id))) !== JSON.stringify(scrub(path))) {
        commonPathsWithEditorialDifferences.push(id);
      }
    }
  }
  const pills = [...livePills.values()].map((item) => structuredClone(item));
  for (const [id, pill] of refPills) if (!livePills.has(id)) pills.push(structuredClone(pill));
  const labels = { ...(reference.tag_labels || {}), ...(live.tag_labels || {}) };
  const candidate = {
    ...structuredClone(live),
    thematic_pills: pills,
    books,
    paths,
    tag_labels: labels,
  };
  validateLinks(candidate);
  for (const [id, book] of liveBooks) {
    const finalBook = books.find((entry) => entry.id === id);
    if (finalBook.status !== book.status || finalBook.notes !== book.notes) {
      throw new Error(`Personal fields changed on existing book ${id}`);
    }
  }
  for (const [id, path] of livePaths) {
    const finalPath = paths.find((entry) => entry.id === id);
    if (JSON.stringify(finalPath) !== JSON.stringify(path)) {
      throw new Error(`Existing path modified: ${id}`);
    }
  }
  return {
    candidate,
    report: {
      originalBooks: liveBooks.size,
      referenceBooks: refBooks.size,
      resultBooks: books.length,
      addedBookIds: additions,
      originalPaths: livePaths.size,
      resultPaths: paths.length,
      addedPathIds: newPaths,
      relatedListsExpanded: relatedExpanded,
      commonEditorialDifferencesNotApplied: commonEditorialDifferences,
      commonPathEditorialDifferencesNotApplied: commonPathsWithEditorialDifferences,
      existingBooksPreserved: liveBooks.size,
      existingPathsPreserved: livePaths.size,
    },
  };
}

export function validateLinks(data) {
  const books = new Map(data.books.map((b) => [b.id, b]));
  const pills = new Set(data.thematic_pills.map((p) => p.slug));
  if (books.size !== data.books.length) throw new Error('Duplicate book IDs in result');
  if (pills.size !== data.thematic_pills.length) throw new Error('Duplicate thematic pill slugs');
  for (const book of data.books) {
    if (!book.id || !book.title || !book.author || !book.status) {
      throw new Error(`Required fields missing on book ${book.id}`);
    }
    for (const theme of book.themes || []) {
      if (!pills.has(theme)) throw new Error(`Missing theme ${theme} on book ${book.id}`);
    }
    for (const relatedId of book.related || []) {
      if (!books.has(relatedId)) throw new Error(`Missing linked book ${relatedId} on book ${book.id}`);
    }
  }
  const paths = new Set();
  for (const path of data.paths || []) {
    if (paths.has(path.id)) throw new Error(`Duplicate path ${path.id}`);
    paths.add(path.id);
    const ids = path.items?.map((item) => item.book_id) || path.book_ids || [];
    if (!ids.length) throw new Error(`Path ${path.id} has no books`);
    for (const id of ids) if (!books.has(id)) throw new Error(`Path ${path.id} refers to missing book ${id}`);
  }
}
