import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditShelfMap, compareShioriSources, summarizeShioriSource } from './shiori-source-audit-core.mjs';

const root = new URL('../../', import.meta.url);
const library = JSON.parse(readFileSync(new URL('data/spirit/library.json', root), 'utf8'));
const map = JSON.parse(readFileSync(new URL('src/components/spirit/shioriShelves.json', root), 'utf8'));

function sample() {
  return {
    library_version: '1',
    thematic_pills: [{ slug: 'zen', label: 'Zen' }],
    tag_labels: { awareness: 'Éberség' },
    books: [{ id: 'a', title: 'A', author: 'AA', themes: ['zen'], related: ['b'], tags: ['awareness'], status: 'befejezett', notes: 'SECRET PERSONAL NOTE' },
      { id: 'b', title: 'B', author: 'BB', themes: ['zen'], related: [], status: 'olvasatlan' }],
    paths: [{ id: 'path', book_ids: ['a'], progress: 52, items: [{ book_id: 'a', comment: 'SECRET PERSONAL COMMENT' }] }],
  };
}

test('real repository snapshot is detected as 59 books while seven shelves contain 86 IDs', () => {
  const summary = summarizeShioriSource(library);
  assert.equal(summary.bookCount, 59);
  assert.equal(summary.pathCount, 4);
  assert.equal(summary.errors.length, 0);
  const shelves = auditShelfMap(library, map);
  assert.equal(shelves.shelfCount, 7);
  assert.equal(shelves.mappedIds, 86);
  assert.equal(shelves.booksWithoutShelf.length, 0);
  assert.equal(shelves.configuredBooksMissingFromSource.length, 27);
});

test('audit never returns private book or path values, including in editorial diffs', () => {
  const before = sample();
  const after = structuredClone(before);
  after.books[0].status = 'folyamatban';
  after.books[0].notes = 'DIFFERENT SECRET';
  after.paths[0].progress = 99;
  after.paths[0].items[0].comment = 'DIFFERENT PRIVATE COMMENT';
  const result = compareShioriSources(before, after);
  assert.deepEqual(result.changedPublicFields, {});
  assert.equal(result.changedEditorialPathCount, 0);
  assert.equal(result.addedBookIds.length, 0);
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  assert.ok(!JSON.stringify(result).includes('COMMENT'));
  const summary = summarizeShioriSource(before);
  assert.equal(summary.privateCounts.booksWithNotes, 1);
  assert.equal(summary.privateCounts.pathsWithProgress, 1);
  assert.equal(summary.privateCounts.pathItemsWithComments, 1);
  assert.ok(!JSON.stringify(summary).includes('SECRET'));
});

test('editorial comparison reports added ids and changes without mutating input', () => {
  const a = sample();
  const copy = structuredClone(a);
  const b = structuredClone(a);
  b.books.push({ id: 'c', title: 'C', author: 'CC', themes: ['zen'], related: [], status: 'olvasatlan' });
  b.books[0].author = 'Changed';
  b.paths.push({ id: 'new_path', book_ids: ['c'] });
  const report = compareShioriSources(a, b);
  assert.deepEqual(report.addedBookIds, ['c']);
  assert.deepEqual(report.addedPathIds, ['new_path']);
  assert.equal(report.changedPublicFields.author, 1);
  assert.deepEqual(a, copy);
});

test('broken references and duplicate shelf assignments fail visibly', () => {
  const bad = sample();
  bad.books[0].related.push('missing');
  bad.paths[0].items[0].book_id = 'missing';
  const summary = summarizeShioriSource(bad);
  assert.equal(summary.errors.length, 2);
  const shelves = { shelves: Array.from({ length: 7 }, (_, i) => ({ id: String(i), bookIds: ['a'] })) };
  assert.ok(auditShelfMap(bad, shelves).errors.some((err) => err.includes('Duplicate')));
});

test('the library loader disables implicit Blob seeding', () => {
  const source = readFileSync(new URL('src/lib/spiritLibrary.ts', root), 'utf8');
  assert.match(source, /seedIfMissing:\s*false/);
});
