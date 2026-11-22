import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const shelf = readFileSync(join(root, 'src/components/spirit/ShioriShelf.module.css'), 'utf8');
const detail = readFileSync(join(root, 'src/components/spirit/ShioriBookDetail.module.css'), 'utf8');
const room = readFileSync(join(root, 'src/components/spirit/SpiritLibraryApp.module.css'), 'utf8');

test('same painted countertop clearance for spines and featured book', () => {
  assert.match(shelf, /--painted-counter-clearance:clamp\(105px,25dvh,265px\)/);
  assert.match(shelf, /padding-bottom:var\(--painted-counter-clearance\)/);
  assert.match(shelf, /\.featured \{ padding-bottom:0; \}/);
  assert.match(shelf, /\.spines \{ padding-bottom:0; \}/);
});
test('narrow and short desktop screens have explicit counter calibration', () => {
  assert.match(shelf, /max-width:1000px\) and \(min-width:701px/);
  assert.match(shelf, /--painted-counter-clearance:clamp\(86px,19\.5dvh,187px\)/);
  assert.match(shelf, /--painted-counter-clearance:clamp\(69px,15\.5dvh,129px\)/);
});
test('four cover archetypes and washi texturing are connected', () => {
  for (const family of ['coverFamily0','coverFamily1','coverFamily2','coverFamily3']) {
    assert.ok(shelf.includes(`.${family} `) || shelf.includes(`.${family} {`), family);
  }
  for (const file of ['shiori-washi-grain.webp','shiori-wash.webp','shiori-ring.webp','shiori-strokes.webp']) {
    assert.ok(shelf.includes(file), file);
    const p = join(root, 'public/shiori/textures', file);
    assert.ok(existsSync(p), file);
    assert.ok(statSync(p).size > 2000, `${file} too small`);
    assert.equal(readFileSync(p).subarray(8,12).toString('ascii'), 'WEBP', file);
  }
});
test('all four approved environment master images remain active', () => {
  for (const spec of ['day-desktop','night-desktop','day-mobile','night-mobile']) {
    assert.ok(room.includes(`shiori-${spec}-master.webp`), spec);
  }
});
test('desktop reading book is separate from embedded mobile reader', () => {
  assert.match(detail, /\.backdrop \.toolbar \{/);
  assert.match(detail, /\.embedded \.toolbar \{/);
  assert.match(detail, /\.backdrop \.paperPage/);
  assert.match(detail, /\.embedded \.singlePage/);
  assert.match(detail, /\.miniMark/);
});
test('mobile retains independent book view and book list', () => {
  assert.match(shelf, /\.mobileTopExpanded/);
  assert.match(shelf, /\.mobileList \{/);
  assert.match(shelf, /\.mobileFilterButton \{/);
});
test('no second shelf asset is re-introduced', () => {
  assert.match(shelf, /\.woodShelf \{ display:none; \}/);
  assert.doesNotMatch(shelf.slice(shelf.indexOf('Shiori UI polish 02')), /shelf-wood\.svg/);
});
