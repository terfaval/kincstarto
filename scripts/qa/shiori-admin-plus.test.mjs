import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const view = await read('../../src/components/spirit/SpiritLibraryApp.tsx');
const admin = await read('../../src/app/admin/page.tsx');
const publicPage = await read('../../src/app/library/page.tsx');
const transfer = await read('../../src/components/spirit/SpiritJsonTransfer.tsx');
const jsonRoute = await read('../../src/app/api/admin/spirit/json/route.ts');
const blob = await read('../../src/lib/spiritJsonBlob.ts');

test('admin and public share the same Shiori shelf and detail in full-screen layout', () => {
  assert.match(admin, /<SpiritLibraryApp library=\{library\} admin privateEnabled=\{privateEnabled\}(?: localStatusPreview=\{localStatusPreview\})?\s*\/>/);
  assert.match(publicPage, /<SpiritLibraryApp library=\{library\} admin=\{false\}\s*\/>/);
  assert.match(view, /<ShioriShelf\s+fullscreen\s+books=\{viewLibrary\.books\}/);
  assert.match(view, /<ShioriBookDetail/);
  assert.match(view, /styles\.pageShelf/);
  assert.match(view, /styles\.pagePublic/);
  assert.doesNotMatch(view, /SpiritAddBookModal|LayoutList|LogOut|Dumbbell|toggleViewMode|handleStatusToggle/);
});

test('external toolbar is admin only and contains exactly one JSON plus trigger', () => {
  assert.match(view, /\{admin && \(\s*<div className=\{styles\.fabToolbar\}/);
  assert.equal((view.match(/<SpiritJsonTransfer\s+/g) ?? []).length, 1);
  assert.match(transfer, /<Plus size=\{20\}/);
  assert.doesNotMatch(transfer, /FileJson2/);
});

test('admin page reads private state only with active split reader and refreshes dynamic source after save', () => {
  assert.match(admin, /privateShioriReady\(\)/);
  assert.match(admin, /loadSpiritLibrary\(\{ includePrivate: true \}\)/);
  assert.match(admin, /publicShioriCatalog\(await loadSpiritLibrary\(\)\)/);
  assert.match(admin, /dynamic = "force-dynamic"/);
  assert.match(transfer, /requestImport\("apply"\)/);
  assert.match(transfer, /router\.refresh\(\)/);
  assert.match(transfer, /confirm: "IMPORTÁLÁS"/);
});

test('admin JSON apply route persists only after preview version confirmation', () => {
  assert.match(jsonRoute, /requestData\.action === "preview"/);
  assert.match(jsonRoute, /requestData\.baseEtag !== live\.etag/);
  assert.match(jsonRoute, /writeSpiritJsonBlob\(live, validated\)/);
  assert.match(blob, /ifMatch: snapshot\.etag/);
  assert.match(blob, /head\(PATH\)/);
  assert.doesNotMatch(blob, /readJsonStore|writeJsonStore/);
});
