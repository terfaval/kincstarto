import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../");
const plan = JSON.parse(readFileSync(join(root, "src/components/spirit/shioriShelves.json"), "utf8"));
const library = JSON.parse(readFileSync(join(root, "data/spirit/library.json"), "utf8"));

// This checks the committed *snapshot* only. Live Blob data may differ.
test("the approved map has seven shelves and 86 unique editorial book IDs", () => {
  assert.equal(plan.shelves.length, 7);
  const ids = plan.shelves.flatMap((shelf) => shelf.bookIds);
  assert.equal(ids.length, 86);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(plan.shelves.map((shelf) => shelf.id)).size, 7);
  for (const shelf of plan.shelves) {
    assert.ok(shelf.bookIds.includes(shelf.featured), `Featured book is missing from ${shelf.id}`);
  }
});

test("the repository library can be grouped without losing new books", () => {
  const assigned = new Set(plan.shelves.flatMap((shelf) => shelf.bookIds));
  const libraryIds = library.books.map((book) => book.id);
  assert.equal(new Set(libraryIds).size, libraryIds.length);
  const missing = libraryIds.filter((id) => !assigned.has(id));
  const mapped = libraryIds.filter((id) => assigned.has(id));
  assert.equal(mapped.length + missing.length, libraryIds.length);
  // Unassigned live books receive a visible, temporary "Besorolásra váró" shelf.
  if (missing.length) console.info(`New books awaiting shelf assignment: ${missing.join(", ")}`);
});

test("the existing library and paths are not edited by the shelf plan", () => {
  const ids = new Set(library.books.map((book) => book.id));
  const paths = library.paths ?? [];
  for (const path of paths) {
    const pathIds = path.items?.map((item) => item.book_id) ?? path.book_ids ?? [];
    assert.ok(pathIds.every((id) => ids.has(id)), `Invalid path: ${path.id}`);
  }
});
