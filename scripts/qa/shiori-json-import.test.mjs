import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planSpiritJsonImport, SpiritJsonImportError } from '../../src/lib/spiritJsonImport.ts';

const raw = JSON.parse(await readFile(new URL('../../data/spirit/library.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const original = clone(raw);
const book = raw.books[0];
const newBook = {
  id: 'shiori_import_test', title: 'Próba könyv', author: 'Próba szerző',
  tradition: 'taoizmus', level: 'kezdo', summary_short: 'Próba szöveg.',
  recommendation: 'Próba ajánlás.', themes: [book.themes[0]], language: 'hu', format: 'konyv',
  status: 'befejezett', notes: 'Ezt nem szabad importálni.',
  related: [book.id],
};

test('full library roundtrip upsert is unchanged; personal data and paths survive', () => {
  const { candidate, summary } = planSpiritJsonImport(raw, clone(raw), 'upsert');
  assert.deepEqual(candidate, raw);
  assert.equal(summary.updated.length, 0);
  assert.equal(summary.unchanged, raw.books.length);
  assert.equal(summary.ignoredPersonalFields, raw.books.length + raw.books.filter(b => b.notes).length);
});

test('add-only allows batch new books, never overwrites existing book fields', () => {
  const { candidate, summary } = planSpiritJsonImport(raw, { books: [{ id: book.id, title: 'DO NOT MODIFY' }, newBook] }, 'add');
  assert.equal(summary.added[0], newBook.id);
  assert.equal(summary.skippedExisting, 1);
  assert.equal(candidate.books.find(x => x.id === book.id).title, book.title);
  const added = candidate.books.find(x => x.id === newBook.id);
  assert.equal(added.status, 'olvasatlan');
  assert.equal(added.notes, undefined);
  assert.deepEqual(added.related, [book.id]);
  assert.equal(candidate.paths, raw.paths);
  assert.deepEqual(raw, original);
});

test('updates only supplied editorial fields, preserving status, notes, metadata and paths', () => {
  const active = clone(raw);
  active.books[0].status = 'befejezett';
  active.books[0].notes = 'Személyes jegyzet';
  const { candidate, summary } = planSpiritJsonImport(active, {
    books: [{ id: book.id, related: ['kapujanincs_atjaro'], status: 'olvasatlan', notes: 'overwrite?' }],
    paths: [{ id: 'wrong' }], library_version: 'changed', tag_labels: { test: 'wrong' },
  }, 'upsert');
  assert.equal(summary.updated.length, 1);
  assert.deepEqual(summary.updated[0].fields, ['related']);
  assert.deepEqual(summary.updated[0].relatedBefore, book.related);
  assert.deepEqual(summary.updated[0].relatedAfter, ['kapujanincs_atjaro']);
  assert.equal(candidate.books[0].status, 'befejezett');
  assert.equal(candidate.books[0].notes, 'Személyes jegyzet');
  assert.equal(candidate.books[0].title, book.title);
  assert.equal(candidate.paths, active.paths);
  assert.equal(candidate.tag_labels, active.tag_labels);
  assert.equal(candidate.library_version, active.library_version);
});

test('null clears optional field, absent means unchanged, empty array explicitly clears relation', () => {
  const { candidate } = planSpiritJsonImport(raw, [
    { id: book.id, summary_long: null, related: [] },
  ], 'upsert');
  assert.equal(candidate.books[0].summary_long, undefined);
  assert.deepEqual(candidate.books[0].related, []);
  assert.equal(candidate.books[0].recommendation, book.recommendation);
});

test('rejects null required fields, unknown fields and duplicate IDs', () => {
  assert.throws(() => planSpiritJsonImport(raw, [{ id: book.id, title: null }], 'upsert'), SpiritJsonImportError);
  assert.throws(() => planSpiritJsonImport(raw, [{ id: book.id, reltaed: ['x'] }], 'upsert'), SpiritJsonImportError);
  assert.throws(() => planSpiritJsonImport(raw, [{ id: book.id }, { id: book.id }], 'add'), SpiritJsonImportError);
});

test('rejects unsupported formats and identifiers, never deletes missing source records', () => {
  assert.throws(() => planSpiritJsonImport(raw, { paths: [] }, 'upsert'), SpiritJsonImportError);
  assert.throws(() => planSpiritJsonImport(raw, [{ id: '../escape' }], 'add'), SpiritJsonImportError);
  const { candidate } = planSpiritJsonImport(raw, { books: [newBook] }, 'upsert');
  assert.equal(candidate.books.length, raw.books.length + 1);
  assert.equal(candidate.books.filter(b => b.id !== newBook.id).length, raw.books.length);
});

test('Blob transport has strict live read, same-origin admin and conditional ETag write', async () => {
  const file = await readFile(new URL('../../src/lib/spiritJsonBlob.ts', import.meta.url), 'utf8');
  const route = await readFile(new URL('../../src/app/api/admin/spirit/json/route.ts', import.meta.url), 'utf8');
  assert.match(file, /ifMatch: snapshot\.etag/);
  assert.match(file, /readSpiritJsonBlob/);
  assert.doesNotMatch(file, /loadSpiritLibrary|readJsonStore|writeJsonStore/);
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /baseEtag !== live\.etag/);
  assert.match(route, /validateSpiritLibrary\(candidate\)/);
});
