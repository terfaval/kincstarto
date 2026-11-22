import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/components/spirit/ShioriShelf.module.css', 'utf8');
const patch = css.slice(css.indexOf('/* ===== Shiori UI polish 05:'));

test('Polish 05: falitábla emelése és alsó élének megőrzése', () => {
  assert.match(patch, /--shiori-board-lift:\s*clamp\(/);
  assert.match(patch, /transform:\s*translateY\(calc\(-1 \* var\(--shiori-board-lift\)\)\)/);
  assert.match(patch, /height:\s*calc\(100% \+ var\(--shiori-board-lift\)\)/);
});

test('Polish 05: a pult a táblától jobbra a teljes szobaszélességen folytatódik', () => {
  assert.match(patch, /\.desktopStage::before,\s*\.desktopStage::after\s*\{/);
  assert.match(patch, /left:calc\(-1 \* \(clamp\(/);
  assert.match(patch, /right:calc\(-1 \* clamp\(/);
});

test('Polish 05: valódi falap és függőleges fa előlap', () => {
  assert.match(patch, /\.desktopStage::before\s*\{[\s\S]*?height:18px/);
  assert.match(patch, /\.desktopStage::after\s*\{[\s\S]*?height:58px/);
  assert.match(patch, /linear-gradient\(180deg, #b28a60/);
  assert.match(patch, /linear-gradient\(180deg, #8c6546/);
  assert.match(patch, /\.spineFrame,\s*\.featured\s*\{\s*z-index:3/);
});

test('Polish 05: éjszakai színpaletta külön kezelt', () => {
  assert.match(patch, /data-time-theme="night"\]\) \.desktopStage::before/);
  assert.match(patch, /data-time-theme="night"\]\) \.desktopStage::after/);
  assert.match(patch, /prefers-color-scheme:dark/);
});

test('Polish 05: a mobilos nézet táblája és pultja rejtett marad', () => {
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /\.desktopSearch,\.wall,\.desktopStage/);
});
