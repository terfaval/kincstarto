import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/components/spirit/SpiritLibraryApp.tsx');
const appCss = read('src/components/spirit/SpiritLibraryApp.module.css');
const shelfCss = read('src/components/spirit/ShioriShelf.module.css');
const meditation = read('src/features/meditations/styles/meditations.module.css');

test('Shiori reuses the exact Tamayura back-link style and has the same hover label', () => {
  assert.match(app, /import meditationStyles from "@\/features\/meditations\/styles\/meditations\.module\.css"/);
  assert.match(app, /className=\{`\$\{meditationStyles\.backLink\} \$\{styles\.shioriBackLink\}`\}/);
  assert.match(app, /className=\{meditationStyles\.backIcon\}/);
  assert.match(app, /meditationStyles\.backLabel/);
  assert.match(app, />vissza<\/span>/);
  assert.match(meditation, /\.backLink:hover \.backLabel\s*\{/);
  assert.doesNotMatch(app, /styles\.wreathReturn/);
});

test('Tamayura remains unchanged, Shiori fixes the daytime contrast and nighttime label', () => {
  assert.match(appCss, /\.pageShelf \.shioriBackLink\s*\{\s*color:\s*#342c25/);
  assert.match(appCss, /:global\(:root\[data-time-theme="night"\]\) \.pageShelf \.shioriBackLink/);
  assert.match(appCss, /:global\(:root\[data-time-theme="night"\]\) \.pageShelf \.shioriBackLabel/);
  assert.match(appCss, /\.shioriBackLink:focus-visible \.shioriBackLabel/);
});

test('night controls are ink-blue again, including text, icon and dark-mode fallback', () => {
  const controlSection = shelfCss.slice(shelfCss.indexOf('/* Day controls are paper-toned'));
  assert.match(controlSection, /:root\[data-time-theme="night"\]/);
  assert.match(controlSection, /background:rgba\(34,40,50,\.83\)/);
  assert.match(controlSection, /\.searchInput input::placeholder \{ color:#ddd0bb;/);
  assert.match(controlSection, /\.searchInput svg \{ color:#f0e4d0;/);
  assert.match(controlSection, /:root:not\(\[data-time-theme\]\)/);
  assert.doesNotMatch(controlSection, /background:rgba\(240,232,213,\.89\)/);
});
