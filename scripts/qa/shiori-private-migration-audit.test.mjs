import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditShioriMigrationData as coreAudit } from './shiori-migration-audit-core.mjs';
import {
  extractShioriPrivateState, mergeShioriPrivateState, publicShioriHasPersonalFields,
  publicShioriJson, validateShioriPrivateState,
} from '../../src/lib/shioriPrivateState.ts';
const auditShioriMigrationData = (raw, parsed) => coreAudit(raw, parsed, {
  extractShioriPrivateState, mergeShioriPrivateState, publicShioriHasPersonalFields,
  publicShioriJson, validateShioriPrivateState,
});

const fixture = JSON.parse(await readFile(new URL('../../data/spirit/library.json', import.meta.url), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));

// In a pure unit test, the validated library matches the raw fixture.
// A later case simulates unknown editorial fields dropped by Zod.
test('legacy catalog has no automatic migration permission', () => {
  const raw = clone(fixture);
  const result = auditShioriMigrationData(raw, clone(raw));
  assert.equal(result.ownershipReviewRequired, true);
  assert.equal(result.eligibleForAutomaticMigration, false);
  assert.equal(result.editorialProjectionLossless, true);
  assert.equal(result.privateRoundtripLossless, true);
  assert.equal(result.books, raw.books.length);
  assert.equal(result.paths, raw.paths.length);
});

test('the 94-book / 8-path shape stays whole in a synthetic future snapshot', () => {
  const raw = clone(fixture);
  while (raw.books.length < 94) raw.books.push({
    ...clone(fixture.books[0]), id:`qa_book_${raw.books.length}`,
    title:`QA book ${raw.books.length}`, related: [],
  });
  while (raw.paths.length < 8) raw.paths.push({
    ...clone(fixture.paths[0]), id:`qa_path_${raw.paths.length}`,
  });
  const result = auditShioriMigrationData(raw, clone(raw));
  assert.equal(result.books, 94);
  assert.equal(result.paths, 8);
  assert.equal(result.editorialProjectionLossless, true);
  assert.equal(result.privateRoundtripLossless, true);
});

test('private status, notes, progress and comment counts are safe, not their contents', () => {
  const raw = clone(fixture);
  for (const book of raw.books) { delete book.notes; book.status = 'olvasatlan'; }
  for (const path of raw.paths) {
    delete path.progress;
    for (const item of path.items ?? []) delete item.comment;
  }
  raw.books[0].status = 'befejezett';
  raw.books[1].notes = 'Confidential example value: not for output';
  raw.paths[0].progress = 0;
  if (!raw.paths[0].items) raw.paths[0].items = [{book_id:raw.books[0].id}];
  raw.paths[0].items[0].comment = 'Secret test comment';
  const report = auditShioriMigrationData(raw, clone(raw));
  assert.equal(report.nonDefaultStatuses, 1);
  assert.equal(report.booksWithNotes, 1);
  assert.equal(report.pathsWithProgress, 1);
  assert.equal(report.pathComments, 1);
  assert.equal(report.ambiguousLegacyNotes, true);
  assert.equal(report.privateRoundtripLossless, true);
  assert.doesNotMatch(JSON.stringify(report), /Confidential|Secret/);
});

test('new unknown editorial field cannot be silently discarded', () => {
  const raw = clone(fixture);
  raw.books[0].future_cover_asset_contract = 'must survive';
  const parsed = clone(raw);
  delete parsed.books[0].future_cover_asset_contract;
  const result = auditShioriMigrationData(raw, parsed);
  assert.equal(result.editorialProjectionLossless, false);
});

test('duplicate path book comments with different contents fail roundtrip', () => {
  const raw = clone(fixture);
  raw.paths[0].items = [
    {book_id:raw.books[0].id, comment:'first'},
    {book_id:raw.books[0].id, comment:'second'},
  ];
  const result = auditShioriMigrationData(raw, clone(raw));
  assert.equal(result.privateRoundtripLossless, false);
});

test('raw shape and validation count mismatches stop', () => {
  assert.throws(() => auditShioriMigrationData({}, fixture));
  const raw = clone(fixture);
  const parsed = clone(raw);
  parsed.books.pop();
  assert.throws(() => auditShioriMigrationData(raw, parsed));
});

test('runtime route is GET-only, admin-protected, with no mutation code', async () => {
  const route = await readFile(new URL('../../src/app/api/admin/spirit/private-migration-audit/route.ts', import.meta.url), 'utf8');
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /await requireAdmin\(\)/);
  assert.match(route, /await preflight\(/);
  assert.match(route, /auditShioriMigrationData\(/);
  assert.match(route, /SOURCE_VERSION/);
  assert.match(route, /LAST_OBSERVED_SHA256/);
  assert.match(route, /"NO_WRITES"/);
  assert.doesNotMatch(route, /export async function (POST|PUT|DELETE|PATCH)/);
  assert.doesNotMatch(route, /\b(?:put|del|copy)\s*\(/);
  assert.doesNotMatch(route, /console\.log\(|console\.error\(/);
});

test('legacy apply is locked while ownership and notes remain unclassified', async () => {
  const script = await readFile(new URL('./shiori-private-state-migrate.mjs', import.meta.url), 'utf8');
  assert.match(script, /SHIORI_05C_APPLY_LOCKED/);
  assert.match(script, /if \(action === 'apply'\)/);
  assert.match(script, /ifMatch: pub\.meta\.etag/); // pre-existing guarded implementation left intact
});
