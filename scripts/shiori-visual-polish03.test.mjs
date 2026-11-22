import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shelf = readFileSync(new URL('../src/components/spirit/ShioriShelf.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/spirit/ShioriShelf.module.css', import.meta.url), 'utf8');

test('all spine pages are slices of complete books', () => {
  assert.match(shelf, /Math\.floor\(\(available \+ gap\) \/ \(spineWidth \+ gap\)\)/);
  assert.match(shelf, /const visibleSpines = shownBooks\.slice\(pageStart, pageStart \+ spinesPerPage\)/);
  assert.match(shelf, /ResizeObserver\(measure\)/);
  assert.match(shelf, /\{visibleSpines\.map\(\(book\) =>/);
  assert.match(css, /\.spineFrame \.spines \{[^}]*overflow-x:hidden/);
});
test('spine pages respond to arrows and keyboard/touch/trackpad', () => {
  assert.match(shelf, /aria-label="Előző könyvek"/);
  assert.match(shelf, /aria-label="Következő könyvek"/);
  assert.match(shelf, /event\.key === "ArrowRight"/);
  assert.match(shelf, /onTouchEnd=/);
  assert.match(shelf, /onWheel=/);
  assert.doesNotMatch(shelf, /stepCollection\(/);
});
test('no orphan desktop book title or total at the foot of the room', () => {
  assert.doesNotMatch(shelf, /className=\{styles\.desktopFooter\}/);
  assert.match(css, /\.desktopFooter \{ display:none; \}/);
});
test('desktop empty book zone has readable, noninteractive ghost selection', () => {
  assert.match(shelf, /Válassz egy könyvet/);
  assert.match(shelf, /Kattints egy gerincre/);
  assert.match(css, /\.stageRest\s*\{[^}]*display:flex/s);
  assert.match(css, /:global\(:root\[data-time-theme="night"\]\) \.stageRest/);
});
test('filter control is labeled and remains accessible', () => {
  assert.match(shelf, /aria-label="Szűrők megnyitása"/);
  assert.doesNotMatch(shelf, /<span>Szűrők<\/span>/); // Desktop: icon-only, accessible name retained.
  assert.match(shelf, /aria-expanded=\{filterPanel\}/);
  assert.match(shelf, /className=\{styles\.mobileFilterButton\}/);
});
test('books are still selected and opened with previous gestures', () => {
  assert.match(shelf, /onClick=\{\(\) => selectBook\(book\)\}/);
  assert.match(shelf, /onDoubleClick=\{\(\) => onOpenBook\(book\)\}/);
  assert.match(shelf, /onClick=\{\(\) => onOpenBook\(current\)\}/);
});
