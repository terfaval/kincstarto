import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/components/spirit/SpiritLibraryApp.module.css');
const shelfCss = read('src/components/spirit/ShioriShelf.module.css');
const shelf = read('src/components/spirit/ShioriShelf.tsx');
const detailCss = read('src/components/spirit/ShioriBookDetail.module.css');
const admin = read('src/components/spirit/SpiritJsonTransfer.tsx');

for (const [name, file] of [
  ['nappali desktop', 'shiori-day-desktop-master.webp'],
  ['éjszakai desktop', 'shiori-night-desktop-master.webp'],
  ['nappali mobil', 'shiori-day-mobile-master.webp'],
  ['éjszakai mobil', 'shiori-night-mobile-master.webp'],
]) {
  test(`${name} master képe a repóban és a CSS-ben`, () => {
    assert.ok(existsSync(new URL(`../public/shiori/backgrounds/${file}`, import.meta.url)));
    assert.ok(app.includes(file), `${file} nincs bekötve`);
  });
}

test('a korábbi trial háttér már nem aktív', () => {
  assert.ok(!app.includes('url(\'/shiori/backgrounds/shiori-sumi-room-trial.webp\')'));
});

test('a második, dekoratív polcsín nem látszik', () => {
  assert.match(shelfCss, /\.woodShelf\s*\{\s*display:\s*none/);
});

test('a teljes szobát fedő shell átlátszó és keret nélküli', () => {
  assert.match(shelfCss, /\.shell\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
});

test('a desktop kezdő állapotban nincs kijelölt könyv', () => {
  assert.match(shelf, /useState<string \| null>\(null\)/);
  assert.match(shelf, /stageRest/);
});

test('négy borító- és gerinccsalád továbbra is létezik', () => {
  for (const i of [0,1,2,3]) {
    assert.ok(shelfCss.includes(`.coverFamily${i}`));
  }
  for (const i of [1,2,3]) assert.ok(shelfCss.includes(`.spineFamily${i}`));
  assert.ok(shelf.includes('coverVariant(current)'));
  assert.ok(shelf.includes('spineVariant(book)'));
});

test('a desktop könyvoldalak külön görgethetők maradnak', () => {
  assert.match(detailCss, /\.paperPage\s*\{[^}]*overflow-y:auto/s);
});

test('a mobilos könyvlista önállóan görgethető marad', () => {
  assert.match(shelfCss, /\.mobileList\s*\{[^}]*overflow-y:auto/s);
});

test('az adminban az előnézet és az éles jóváhagyás külön maradt', () => {
  assert.ok(admin.includes('requestImport("preview")'));
  assert.ok(admin.includes('requestImport("apply")'));
  assert.ok(admin.includes('!confirmed || Boolean(busy) || outcomeUnknown'));
  assert.ok(admin.includes('aria-label="Teljes könyvtár exportálása"'));
});
