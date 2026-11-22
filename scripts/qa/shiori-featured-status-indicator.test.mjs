import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const shelf = read('src/components/spirit/ShioriShelf.tsx');
const css = read('src/components/spirit/ShioriShelf.module.css');
const app = read('src/components/spirit/SpiritLibraryApp.tsx');
const admin = read('src/app/admin/page.tsx');
const publicPage = read('src/app/library/page.tsx');

test('four status icons are distinct and contain no editorial or personal text on covers', () => {
  assert.match(shelf, /olvasatlan:\s*"Olvasatlan"/);
  assert.match(shelf, /folyamatban:\s*"Folyamatban"/);
  assert.match(shelf, /befejezett:\s*"Befejezett"/);
  assert.match(shelf, /referencia:\s*"Referencia"/);
  assert.match(shelf, /status === "folyamatban" \? BookOpen/);
  assert.match(shelf, /status === "befejezett" \? Check/);
  assert.match(shelf, /status === "referencia" \? Bookmark : Circle/);
  assert.match(shelf, /<Icon size=\{15\} strokeWidth=\{2\.1\}/);
  assert.match(shelf, /aria-hidden="true"/);
  assert.doesNotMatch(shelf, /<PrivateCoverStatus[^>]*notes=/);
});

test('desktop and mobile covers show status only for authorized admin or explicit local demonstration', () => {
  assert.equal((shelf.match(/\{currentCoverStatus && <PrivateCoverStatus status=\{currentCoverStatus\} \/>\}/g) ?? []).length, 2);
  assert.equal((shelf.match(/Olvasottság: \$\{STATUS_LABELS\[current\.status\]\}/g) ?? []).length, 4);
  assert.equal((shelf.match(/title=\{canManagePrivate \? `Olvasottság:/g) ?? []).length, 2);
  assert.match(shelf, /className=\{`\$\{styles\.bookCover\}/);
  assert.match(shelf, /className=\{`\$\{styles\.mobileCover\}/);
  assert.match(shelf, /canManagePrivate = false/);
});

test('indicator uses a compact, non-interactive corner overlay on both cover sizes', () => {
  assert.match(css, /\.bookCover > \.coverStatus,\s*\.mobileCover > \.coverStatus/);
  assert.match(css, /\.bookCover > \.coverStatus,[\s\S]*?position:absolute/);
  assert.match(css, /\.bookCover > \.coverStatus,[\s\S]*?pointer-events:none/);
  assert.match(css, /@media \(max-width:700px\)\s*\{\s*\.mobileCover > \.coverStatus/);
});

test('public route never loads a private snapshot, while admin status edits refresh the highlighted book', () => {
  assert.match(admin, /if \(!\(await isAdminRequest\(\)\)\) redirect\("\/login"\)/);
  assert.match(admin, /loadSpiritLibrary\(\{ includePrivate: true \}\)/);
  assert.match(publicPage, /publicShioriCatalog\(await loadSpiritLibrary\(\)\)/);
  assert.match(publicPage, /admin=\{false\}/);
  assert.match(app, /canManagePrivate = admin && privateEnabled/);
  assert.match(app, /book\.id === id \? \{ \.\.\.book, status, notes: notes \|\| undefined \} : book/);
  assert.match(app, /canManagePrivate=\{canManagePrivate\}/);
});
