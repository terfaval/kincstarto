import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const tsx = readFileSync('src/components/spirit/ShioriShelf.tsx', 'utf8');
const css = readFileSync('src/components/spirit/ShioriShelf.module.css', 'utf8');

const portion = tsx.slice(tsx.indexOf('{filterPanel && <div className={styles.filterBackdrop}'));

test('filter keeps the global query and existing changeFilter state updates', () => {
  assert.match(tsx, /const searchActive = Boolean\(query\.trim\(\)\)/);
  assert.match(tsx, /const changeFilter = \(key: FilterGroup, value: string\)/);
  assert.match(portion, /onChange=\{\(event\) => changeQuery\(event\.target\.value\)\}/);
  assert.match(portion, /onChange=\{\(\) => changeFilter\(key, option\.value\)\}/);
});

test('live result count and selected filter chips are tied to actual state', () => {
  assert.match(portion, /aria-live="polite"/);
  assert.match(portion, /\{shownBooks\.length\} könyv/);
  assert.match(portion, /activeFilterChips\.map/);
  assert.match(portion, /changeFilter\(key, value\)/);
  assert.match(tsx, /filterOptions\[key\]\.find/);
});

test('dialog close restores focus; choices keep native accessible checkboxes', () => {
  assert.match(tsx, /const closeFilters = \(\) => \{/);
  assert.match(tsx, /\(mobile \? filterTriggerRef : desktopFilterRef\)\.current\?\.focus\(\)/);
  assert.match(portion, /aria-labelledby="shiori-filter-title"/);
  assert.match(portion, /type="checkbox" checked=\{filters\[key\]\.includes\(option\.value\)\}/);
  assert.match(portion, /className=\{styles\.filterGroup\}/);
});

test('main action closes panel and preserves filtering; reset clears only filters', () => {
  assert.match(portion, /className=\{styles\.filterShowResults\} onClick=\{closeFilters\}/);
  assert.match(portion, /onClick=\{\(\) => setFilters\(EMPTY_FILTERS\)\}/);
  assert.match(portion, /\{searchActive && <button[^>]*onClick=\{backToBrowse\}/);
});

test('drawers remain separate from approved shelf, covers and room assets', () => {
  assert.match(css, /Shiori polish 06/);
  assert.match(css, /\.filterTop\s*\{/);
  assert.match(css, /\.filterActiveChips\s*\{/);
  assert.match(css, /\.filterGroupCount\s*\{/);
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(tsx, /className=\{styles\.desktopStage\}/);
  assert.match(tsx, /className=\{styles\.mobileList\}/);
});
