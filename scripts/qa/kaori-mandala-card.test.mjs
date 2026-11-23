import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync('src/features/kaori/components/KaoriApp.tsx', 'utf8');
const css = readFileSync('src/features/kaori/components/KaoriApp.module.css', 'utf8');

test('mandala uses the full label layer rather than the top illustration strip', () => {
  assert.match(component, /className=\{styles\.cardMandalaFrame\}/);
  assert.doesNotMatch(component, /cardIllustration|cardEmblem/);
  assert.match(css, /\.cardMandalaFrame\s*\{[^}]*position:\s*absolute;\s*inset:\s*7px;/);
  assert.match(css, /\.cardMandala\s*\{[^}]*background-image:\s*var\(--mandala-image\)/);
  assert.match(css, /mask-image:linear-gradient\(to bottom/);
});

test('stable tea based cropping inputs remain wired to the card', () => {
  assert.match(component, /teaVisuals\.get\(tea\.id\)/);
  assert.match(component, /--mandala-position-x/);
  assert.match(component, /--mandala-position-y/);
  assert.match(component, /--mandala-scale/);
  assert.match(component, /--mandala-rotation/);
  assert.match(css, /--mandala-position-x/);
  assert.match(css, /--mandala-position-y/);
  assert.match(css, /--mandala-scale/);
  assert.match(css, /--mandala-rotation/);
});
