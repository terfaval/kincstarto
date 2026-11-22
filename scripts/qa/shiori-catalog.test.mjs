import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { orderShioriBooks, publicShioriCatalog } from '../../src/lib/shioriCatalog.ts';

const library = JSON.parse(readFileSync(new URL('../../data/spirit/library.json', import.meta.url), 'utf8'));
const shelves = JSON.parse(readFileSync(new URL('../../src/components/spirit/shioriShelves.json', import.meta.url), 'utf8'));

test('public projection does not leak legacy personal statuses, notes or path progress', () => {
  const source = structuredClone(library);
  const sample = structuredClone(library);
  sample.books[0].status = 'befejezett';
  sample.books[0].notes = 'PRIVATE TEST NOTES';
  if (sample.paths?.length) sample.paths[0].progress = 73;
  const projected = publicShioriCatalog(sample);
  assert.equal(projected.books[0].status, 'olvasatlan');
  assert.ok(!('notes' in projected.books[0]));
  assert.ok(!projected.paths?.some((path) => 'progress' in path));
  assert.ok(!JSON.stringify(projected).includes('PRIVATE TEST NOTES'));
  assert.equal(sample.books[0].status, 'befejezett');
  assert.equal(library.books[0].status, source.books[0].status);
  assert.equal(projected.books.length, sample.books.length);
  assert.deepEqual(projected.books.map((b) => b.id), sample.books.map((b) => b.id));
});

test('author order uses an explicitly curated sort key, then title and id', () => {
  const [template] = library.books;
  const books = [
    {...template,id:'z',title:'B',author:'Someone',author_sort_key:'C'},
    {...template,id:'y',title:'A',author:'Someone',author_sort_key:'B'},
    {...template,id:'x',title:'A',author:'Someone',author_sort_key:'B'},
  ];
  assert.deepEqual(orderShioriBooks(books).map((b) => b.id), ['x','y','z']);
  assert.equal(books[0].id, 'z');
});

test('local source count and approved shelf-map coverage are explicitly different', () => {
  const ids = shelves.shelves.flatMap((shelf) => shelf.bookIds);
  assert.equal(new Set(ids).size, ids.length, 'each book appears in just one curated shelf');
  assert.equal(shelves.shelves.length, 7);
  assert.equal(ids.length, 86, 'approved editorial map is 86 books');
  assert.equal(library.books.length, 59, 'repo fallback has 59 books');
  assert.equal(library.paths.length, 4, 'repo fallback has 4 paths');
  assert.ok(library.books.every((book) => ids.includes(book.id)), 'repo books all mapped');
});
