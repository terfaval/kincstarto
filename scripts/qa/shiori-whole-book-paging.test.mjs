import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wholeBookCapacity } from '../../src/lib/shioriWholeBookPaging.ts';

const read = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const shelf = read('src/components/spirit/ShioriShelf.tsx');
const css = read('src/components/spirit/ShioriShelf.module.css');

test('mobile viewport contains a whole number of native-scrolling 86px rows', () => {
  const row = 86, gap = 4, inset = 10;
  for (const viewport of [390, 450, 535, 600, 740, 835]) {
    const n = wholeBookCapacity(viewport, row, gap, inset);
    const used = n * row + (n - 1) * gap;
    assert.ok(used <= viewport - inset, `book clipped at ${viewport}px`);
    assert.ok(used + row + gap > viewport - inset - 1, `unexpected spare slot at ${viewport}px`);
  }
});

test('desktop capacity never leaves a partially visible spine at the right edge', () => {
  for (const available of [231, 318, 365, 454, 520, 801]) {
    for (const spineWidth of [33, 39.25, 50]) {
      const n = wholeBookCapacity(available, spineWidth, 4, 6);
      assert.ok(n * spineWidth + (n - 1) * 4 + 6 <= available, `clipped spine at ${available}px`);
    }
  }
  assert.equal(wholeBookCapacity(500, 50, 4, 6), 9);
});

test('invalid or tiny measurements retain at least one slot', () => {
  for (const v of [0, 10, NaN, Infinity, -50]) assert.equal(wholeBookCapacity(v, 86, 4, 67), 1);
  assert.equal(wholeBookCapacity(700, 0, 4), 1);
});

test('mobile retains native kinetic scrolling and snaps only when movement settles', () => {
  assert.match(shelf, /const viewport = mobileViewportRef\.current/);
  assert.match(shelf, /observer\.observe\(viewport\)/);
  assert.match(shelf, /shownBooks\.map\(\(book\) =>/);
  assert.match(shelf, /--mobile-whole-height/);
  assert.match(shelf, /mobileListScroll\.current = listRef\.current\?\.scrollTop/);
  assert.doesNotMatch(shelf, /setMobilePage\(/);
  assert.doesNotMatch(shelf, /visibleMobileBooks/);
  assert.doesNotMatch(shelf, /onWheel=\{\(event\) => \{[\s\S]*mobileWheelTurnAt/);
  assert.match(css, /\.mobileViewport \{/);
  assert.match(css, /height:min\(100%,var\(--mobile-whole-height,100%\)\)/);
  assert.match(css, /scroll-snap-type:y mandatory/);
  assert.match(css, /scroll-snap-align:start/);
  assert.match(css, /touch-action:pan-y/);
  assert.match(css, /overflow-y:auto/);
  assert.doesNotMatch(shelf, /className=\{styles\.mobilePager\}/);
});

test('desktop measures the non-quantized parent before assigning strip width', () => {
  assert.match(shelf, /const frame = spineFrameRef\.current/);
  assert.match(shelf, /wholeBookCapacity\(frame\.clientWidth, spineWidth, gap, padding\)/);
  assert.match(shelf, /setDesktopStripWidth/);
  assert.match(css, /width:min\(100%,var\(--desktop-spine-strip-width,100%\)\)/);
  assert.match(css, /\.spineFrame \.spines > \.spine \{/);
});

test('desktop trackpad and touch scroll a complete-spine strip, not sliced pages', () => {
  assert.match(shelf, /shownBooks\.map\(\(book\) =>/);
  assert.match(shelf, /onScroll=\{\(event\) =>/);
  assert.match(shelf, /deck\.scrollBy\(\{ left: direction \* count \* step, behavior: "smooth" \}\)/);
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(css, /scroll-snap-align:start/);
  assert.match(css, /overflow-x:auto/);
  assert.doesNotMatch(shelf, /visibleSpines\.map/);
});

test('all four privately visible status markers have high contrast on mobile spines', () => {
  assert.match(shelf, /data-status=\{status\}/);
  assert.match(shelf, /coverStatusForBook\(book, canManagePrivate, localStatusPreview\)/);
  assert.match(css, /\.mobileSpine > \.coverStatus \{[\s\S]*?width:29px;[\s\S]*?background:#fff2d7/);
  for (const status of ['folyamatban', 'befejezett', 'referencia']) {
    assert.ok(css.includes(`.mobileSpine > .coverStatus[data-status="${status}"]`));
  }
});
