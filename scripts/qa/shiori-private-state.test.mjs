import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  extractShioriPrivateState, mergeShioriPrivateState,
  publicShioriJson, publicShioriHasPersonalFields,
  validateShioriPrivateState,
} from '../../src/lib/shioriPrivateState.ts';

const source = JSON.parse(await readFile(new URL('../../data/spirit/library.json', import.meta.url), 'utf8'));

test('old source is recognized as containing personally identifiable reading activity', () => {
  assert.equal(publicShioriHasPersonalFields(source), true);
});

test('private extraction preserves statuses, notes, progress and path comments', () => {
  const state = extractShioriPrivateState(source);
  const clean = JSON.parse(publicShioriJson(source));
  assert.equal(publicShioriHasPersonalFields(clean), false);
  const roundtrip = mergeShioriPrivateState(clean, validateShioriPrivateState(state));
  assert.deepEqual(roundtrip.books.map((b) => [b.id, b.status, b.notes]),
    source.books.map((b) => [b.id, b.status, b.notes]));
  assert.deepEqual(roundtrip.paths?.map((p) => [p.id, p.progress, p.items]),
    source.paths?.map((p) => [p.id, p.progress, p.items]));
  assert.equal(roundtrip.books.length, source.books.length);
});

test('published source does not contain personal field keys anywhere in books or paths', () => {
  const clean = JSON.parse(publicShioriJson(source));
  for (const book of clean.books) {
    assert.equal(Object.hasOwn(book, 'status'), false);
    assert.equal(Object.hasOwn(book, 'notes'), false);
  }
  for (const path of clean.paths ?? []) {
    assert.equal(Object.hasOwn(path, 'progress'), false);
    for (const item of path.items ?? []) assert.equal(Object.hasOwn(item, 'comment'), false);
  }
});

test('private merge does not mutate input library or personal state', () => {
  const clean = JSON.parse(publicShioriJson(source));
  const before = JSON.stringify(clean);
  const state = extractShioriPrivateState(source);
  const pBefore = JSON.stringify(state);
  mergeShioriPrivateState(clean, state);
  assert.equal(JSON.stringify(clean), before);
  assert.equal(JSON.stringify(state), pBefore);
});

test('rejects unknown private-state properties or unexpected status values', () => {
  assert.throws(() => validateShioriPrivateState({ version: 1, books: { a: { status: 'admin' } }, paths: {} }));
  assert.throws(() => validateShioriPrivateState({ version: 1, books: {}, paths: {}, secret: true }));
  assert.throws(() => validateShioriPrivateState({ version: 1, books: {}, paths: { p: { progress: 200 } } }));
});

test('old raw public statuses are not enough to authorize post-migration public reads', async () => {
  const file = await readFile(new URL('../../src/lib/spiritLibrary.ts', import.meta.url), 'utf8');
  assert.match(file, /publicShioriHasPersonalFields\(JSON\.parse\(live\.raw\)\)/);
  assert.match(file, /readShioriPrivateBlob\(\)/);
  assert.match(file, /throw new Error\("Elavult Shiori-mentés/);
});

test('all legacy mutation routes are either private or retired; JSON output requires admin', async () => {
  const files = {
    status: await readFile(new URL('../../src/app/api/admin/spirit/status/route.ts', import.meta.url), 'utf8'),
    path: await readFile(new URL('../../src/app/api/admin/spirit/path/route.ts', import.meta.url), 'utf8'),
    save: await readFile(new URL('../../src/app/api/admin/spirit/save/route.ts', import.meta.url), 'utf8'),
    json: await readFile(new URL('../../src/app/api/admin/spirit/json/route.ts', import.meta.url), 'utf8'),
    blob: await readFile(new URL('../../src/lib/spiritJsonBlob.ts', import.meta.url), 'utf8'),
  };
  for (const s of [files.status, files.path, files.save, files.json]) assert.match(s, /requireAdmin/);
  assert.match(files.status, /updateShioriPrivateBlob/);
  assert.match(files.path, /writeSpiritJsonBlob/);
  assert.match(files.save, /status: 410/);
  assert.match(files.json, /mergeShioriPrivateState/);
  assert.match(files.blob, /publicShioriJson\(library\)/);
  assert.match(files.blob, /ifMatch: snapshot\.etag/);
});

test('migration defaults to read-only and never logs the raw JSON', async () => {
  const file = await readFile(new URL('./shiori-private-state-migrate.mjs', import.meta.url), 'utf8');
  assert.match(file, /'check'/);
  assert.match(file, /SHIORI PRIVATE ALLAPOT ATVITEL/);
  assert.match(file, /ifMatch: pub\.meta\.etag/);
  assert.match(file, /PRIVATE STATE VERIFIED/);
  assert.doesNotMatch(file, /console\.log\(.*pub\.raw/);
});
