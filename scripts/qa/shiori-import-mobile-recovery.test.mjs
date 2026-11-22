import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waitForShioriRevision } from '../../src/lib/shioriImportRefresh.ts';

const file = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const transfer = file('src/components/spirit/SpiritJsonTransfer.tsx');
const shelf = file('src/components/spirit/ShioriShelf.tsx');
const shelfCss = file('src/components/spirit/ShioriShelf.module.css');
const detail = file('src/components/spirit/ShioriBookDetail.tsx');
const boundary = file('src/app/admin/error.tsx');

test('post-import readiness accepts the exact revision, retrying only read operations', async () => {
  let reads = 0;
  const delays = [];
  const ready = await waitForShioriRevision('new-revision', async () => {
    reads++;
    if (reads === 1) throw new Error('temporarily stale Blob');
    if (reads === 2) return 'old-revision';
    return 'new-revision';
  }, async (ms) => { delays.push(ms); }, [0, 200, 400, 800]);
  assert.equal(ready, true);
  assert.equal(reads, 3);
  assert.deepEqual(delays, [200, 400]);
});

test('post-import readiness never treats a stale revision as success', async () => {
  let reads = 0;
  const ready = await waitForShioriRevision('new', async () => { reads++; return 'old'; }, async () => {}, [0, 1, 2]);
  assert.equal(ready, false);
  assert.equal(reads, 3);
});

test('import refresh runs only after a verified GET and never repeats the write', () => {
  assert.match(transfer, /await waitForShioriRevision\(sha/);
  assert.match(transfer, /fetch\(API, \{ cache: "no-store" \}\)/);
  assert.match(transfer, /if \(readable\) \{/);
  assert.match(transfer, /router\.refresh\(\)/);
  assert.match(transfer, /Ne importáld újra/);
  assert.match(transfer, /Könyvtár frissítésének ellenőrzése/);
  assert.equal((transfer.match(/fetch\(API,\{method:"POST"/g) ?? []).length, 1);
});

test('mobile browse uses horizontal stacked books with no translucent panel and opens full-height detail', () => {
  assert.match(shelf, /shownBooks\.map\(\(book\) =>/);
  assert.match(shelf, /className=\{styles\.mobileBookItem\}/);
  assert.doesNotMatch(shelf, /mobileShelves\.map/);
  assert.match(shelf, /styles\.spine\} \$\{styles\.mobileSpine\}/);
  assert.match(shelf, /styles\[`spineFamily\$\{spineVariant\(book\)\}`\]/);
  assert.match(shelf, /<span className=\{styles\.spineTitle\}>\{book\.title\}<\/span>/);
  assert.match(shelf, /onClick=\{\(\) => openBook\(book\)\}/);
  assert.match(shelf, /setDetailStack\(\[book\.id\]\)/);
  assert.match(shelf, /className=\{`\$\{styles\.shell\}.*styles\.mobileDetailOpen/);
  assert.match(shelfCss, /\.mobileSpine::after[\s\S]*?repeating-linear-gradient/);
  assert.match(shelfCss, /\.mobileSpine \.spineTitle[\s\S]*?writing-mode:horizontal-tb/);
  assert.match(shelfCss, /\.mobileList \{[\s\S]*?background:none/);
  assert.match(shelfCss, /\.header,\s*\.sectionHeading \{ display:none; \}/);
  assert.match(shelfCss, /\.mobileDetailOpen \.mobileList/);
  assert.match(shelfCss, /\.mobileDetailOpen \.footer/);
  assert.match(shelf, /listRef\.current\.scrollTop = snapshot\?\.mobileY \?\? 0/);
  assert.match(shelf, /mobileSelectedRowRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(detail, /Vissza a könyvlistához/);
});

test('admin render errors have an explicit user-triggered recovery without a second import', () => {
  assert.match(boundary, /"use client"/);
  assert.match(boundary, /reset\(\); router\.refresh\(\)/);
  assert.match(boundary, /A mentést ne ismételd meg automatikusan/);
});
