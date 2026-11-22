import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditShioriMigrationData } from './shiori-migration-audit-core.mjs';
import {
  extractShioriPrivateState, mergeShioriPrivateState,
  publicShioriHasPersonalFields, publicShioriJson, validateShioriPrivateState,
} from '../../src/lib/shioriPrivateState.ts';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const fixture = JSON.parse(read('data/spirit/library.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const audit = (raw) => auditShioriMigrationData(raw, clone(raw), {
  extractShioriPrivateState, mergeShioriPrivateState,
  publicShioriHasPersonalFields, publicShioriJson, validateShioriPrivateState,
});

test('decision retains existing notes as private, admin-only editorial text', () => {
  const source = clone(fixture);
  source.books[0].notes = 'Internal editorial comment, never public';
  source.books[0].status = 'befejezett';
  const state = extractShioriPrivateState(source);
  const sanitized = JSON.parse(publicShioriJson(source));
  assert.equal(state.books[source.books[0].id].notes, 'Internal editorial comment, never public');
  assert.equal(sanitized.books[0].notes, undefined);
  assert.equal(sanitized.books[0].status, undefined);
  assert.equal(publicShioriHasPersonalFields(sanitized), false);
  const merged = mergeShioriPrivateState(sanitized, validateShioriPrivateState(state));
  assert.equal(merged.books[0].notes, 'Internal editorial comment, never public');
  assert.equal(merged.books[0].status, 'befejezett');
});

test('synthetic 94-book catalog preserves 22 statuses, 10 notes and 8 path progress values', () => {
  const source = clone(fixture);
  while (source.books.length < 94) source.books.push({
    ...clone(source.books[0]), id: `synthetic_${source.books.length}`,
    title: `Synthetic ${source.books.length}`, related: [],
  });
  while (source.paths.length < 8) source.paths.push({
    ...clone(source.paths[0]), id: `path_synthetic_${source.paths.length}`,
  });
  source.books.forEach((book, index) => {
    delete book.notes;
    book.status = index < 22 ? 'befejezett' : 'olvasatlan';
    if (index < 10) book.notes = `Internal editorial text ${index}`;
  });
  source.paths.forEach((path) => {
    path.progress = 0;
    for (const item of path.items ?? []) delete item.comment;
  });
  const result = audit(source);
  assert.equal(result.books, 94);
  assert.equal(result.paths, 8);
  assert.equal(result.nonDefaultStatuses, 22);
  assert.equal(result.booksWithNotes, 10);
  assert.equal(result.pathsWithProgress, 8);
  assert.equal(result.editorialProjectionLossless, true);
  assert.equal(result.privateRoundtripLossless, true);
  assert.doesNotMatch(JSON.stringify(result), /Internal editorial text/);
});

test('writes require preview environment, separate opt-in flag and explicit admin authorization', () => {
  const route = read('src/app/api/admin/spirit/private-migration-apply/route.ts');
  assert.match(route, /await requireAdmin\(request\)/);
  assert.match(route, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(route, /SHIORI_05C2_WRITE_ENABLED === "1"/);
  assert.match(route, /SHIORI_PRIVATE_STATE_READY !== "1"/);
  assert.match(route, /CONFIRMATION_MISSING/);
  assert.match(route, /assertDistinctShioriBlobTokens/);
  assert.match(route, /readShioriPrivateBlob\(\)/);
});

test('private object is written first, without overwrite, then independently verified', () => {
  const route = read('src/app/api/admin/spirit/private-migration-apply/route.ts');
  assert.match(route, /phase === "private"/);
  assert.match(route, /allowOverwrite: false/);
  assert.match(route, /await readPrivateExact\(privateToken\)/);
  assert.match(route, /OUTCOME_UNCERTAIN_DO_NOT_RETRY/);
  assert.ok(route.indexOf('await put(SHIORI_PRIVATE_PATH') < route.indexOf('await put(SHIORI_PUBLIC_PATH'));
});

test('public overwrite is ETag conditional and gated by equal private snapshot', () => {
  const route = read('src/app/api/admin/spirit/private-migration-apply/route.ts');
  assert.match(route, /!isDeepStrictEqual\(existing\.state, candidate\.privateState\)/);
  assert.match(route, /ifMatch: source\.etag/);
  assert.match(route, /source\.sha256 !== SHIORI_REVIEWED_SHA256/);
  assert.match(route, /const immediate = await readSpiritJsonBlob\(\)/);
  assert.match(route, /INDEPENDENT_POSTCHECK_BEFORE_ACTIVATION/);
});

test('historical migration CLI stays locked and the new path never logs private payloads', () => {
  const cli = read('scripts/qa/shiori-private-state-migrate.mjs');
  const route = read('src/app/api/admin/spirit/private-migration-apply/route.ts');
  assert.match(cli, /SHIORI_05C_APPLY_LOCKED/);
  assert.doesNotMatch(route, /console\.log\(|console\.error\(|process\.env\.SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN\b/);
  assert.doesNotMatch(route, /new Response\(.*privateJson/);
});
