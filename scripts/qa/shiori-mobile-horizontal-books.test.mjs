import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const shelf = load('src/components/spirit/ShioriShelf.tsx');
const css = load('src/components/spirit/ShioriShelf.module.css');

test('mobile catalog is a vertical list of horizontal book objects, not shelves or cards', () => {
  assert.match(shelf, /role="list" tabIndex=\{0\} aria-label="A válogatás fekvő könyvei"/);
  assert.match(shelf, /shownBooks\.map\(\(book\) =>/);
  assert.match(shelf, /role="listitem"/);
  assert.match(shelf, /horizontalBookStyle\(book,/);
  assert.doesNotMatch(shelf, /mobileShelves\.map/);
  assert.match(css, /\.mobileSpine \{[\s\S]*?flex-direction:column/);
  assert.match(css, /\.mobileSpine \.spineTitle[\s\S]*?writing-mode:horizontal-tb/);
  assert.match(css, /\.mobileSpine \.spineAuthor[\s\S]*?writing-mode:horizontal-tb/);
  assert.doesNotMatch(css, /\.mobileShelfRow/);
});

test('mobile background is transparent, header absent, detail retains back behavior', () => {
  assert.match(css, /\.header,\s*\.sectionHeading \{ display:none; \}/);
  assert.match(css, /\.mobileList \{[\s\S]*?background:none/);
  assert.match(css, /\.footer \{[\s\S]*?background:none/);
  assert.match(css, /\.mobileDetailOpen \.mobileList/);
  assert.match(css, /\.mobileDetailOpen \.footer/);
  assert.match(shelf, /listRef\.current\.scrollTop = snapshot\?\.mobileY \?\? 0/);
  assert.match(shelf, /setDetailStack\(\[book\.id\]\)/);
  assert.match(shelf, /mobileSelectedRowRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test('private reading status is still restricted to admin or development preview', () => {
  assert.match(shelf, /coverStatusForBook\(book, canManagePrivate, localStatusPreview\)/);
  assert.match(shelf, /\{status && <PrivateCoverStatus status=\{status\} \/>\}/);
  assert.match(css, /\.mobileSpine > \.coverStatus/);
});
