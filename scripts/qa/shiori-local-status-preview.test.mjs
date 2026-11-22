import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const admin = read('src/app/admin/page.tsx');
const publicPage = read('src/app/library/page.tsx');
const app = read('src/components/spirit/SpiritLibraryApp.tsx');
const shelf = read('src/components/spirit/ShioriShelf.tsx');
const privateBlob = read('src/lib/shioriPrivateBlob.ts');

test('local icon preview is limited to authenticated development admin and inactive private reader', () => {
  assert.match(admin, /if \(!\(await isAdminRequest\(\)\)\) redirect\("\/login"\)/);
  assert.match(admin, /const localStatusPreview = process\.env\.NODE_ENV === "development" && !privateEnabled/);
  assert.match(admin, /<SpiritLibraryApp library=\{library\} admin privateEnabled=\{privateEnabled\} localStatusPreview=\{localStatusPreview\}/);
  assert.match(admin, /publicShioriCatalog\(await loadSpiritLibrary\(\)\)/);
  assert.match(app, /localStatusPreview=\{admin && !privateEnabled && localStatusPreview\}/);
  assert.doesNotMatch(publicPage, /localStatusPreview|includePrivate|readShioriPrivateBlob/);
  assert.match(publicPage, /<SpiritLibraryApp library=\{library\} admin=\{false\}/);
});

test('preview uses deterministic synthetic labels but not private values or editing permission', () => {
  assert.match(shelf, /const LOCAL_SAMPLE_STATUSES: SpiritStatus\[\] = \["olvasatlan", "folyamatban", "befejezett", "referencia"\]/);
  assert.match(shelf, /if \(canManagePrivate\) return book\.status/);
  assert.match(shelf, /if \(localStatusPreview\) return LOCAL_SAMPLE_STATUSES\[hashId\(book\.id\) % LOCAL_SAMPLE_STATUSES\.length\]/);
  assert.match(shelf, /return null;/);
  assert.equal((shelf.match(/\{currentCoverStatus && <PrivateCoverStatus status=\{currentCoverStatus\} \/>\}/g) ?? []).length, 1);
  assert.match(shelf, /const status = coverStatusForBook\(book, canManagePrivate, localStatusPreview\)/);
  assert.match(shelf, /\{status && <PrivateCoverStatus status=\{status\} \/>\}/);
  assert.match(shelf, /Helyi státuszikon-minta, nem valódi olvasottság/);
  assert.match(app, /const canManagePrivate = admin && privateEnabled/);
  assert.match(shelf, /\{canManagePrivate && collection\.kind === "path" && currentPath && onPathSaved && \(/);
  assert.match(privateBlob, /process\.env\.SHIORI_PRIVATE_STATE_READY === "1"/);
  assert.doesNotMatch(shelf + admin + app, /SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN|SHIORI_05C2_WRITE_ENABLED/);
});
