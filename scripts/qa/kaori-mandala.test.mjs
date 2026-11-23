import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTeaCardVisual, teaCardMandalaPaths } from '../../src/features/kaori/lib/teaCardMandala.ts';

const taste = {
  fresh: 1,
  sweet: 0,
  sour: 0,
  spicy: 0,
  floral: 3,
  fruity: 2,
  earthy: 0,
  bitter: 0,
  pungent: 0,
  umami: 0,
};

test('tea card mandala detail is stable for a given tea id', () => {
  const first = resolveTeaCardVisual({ id: 'tea_qa_01', tasteProfile: taste });
  const second = resolveTeaCardVisual({ id: 'tea_qa_01', tasteProfile: taste });
  assert.deepEqual(first, second);
  assert.equal(first.topFlavor, 'floral');
  assert.equal(first.mandalaPath, teaCardMandalaPaths['calm-bloom']);
});

test('different tea ids keep the same family but get different crop details', () => {
  const alpha = resolveTeaCardVisual({ id: 'tea_alpha', tasteProfile: taste });
  const beta = resolveTeaCardVisual({ id: 'tea_beta', tasteProfile: taste });
  assert.equal(alpha.mandalaKey, beta.mandalaKey);
  assert.notDeepEqual(
    { x: alpha.focusX, y: alpha.focusY, scale: alpha.scale, rotation: alpha.rotationDeg },
    { x: beta.focusX, y: beta.focusY, scale: beta.scale, rotation: beta.rotationDeg },
  );
});

test('explicit editorial visual override wins over deterministic defaults', () => {
  const visual = resolveTeaCardVisual({
    id: 'tea_custom',
    tasteProfile: taste,
    visual: { mandalaKey: 'fresh-green', focusX: 0.25, focusY: 0.7, scale: 1.9, rotationDeg: -6 },
  });
  assert.equal(visual.mandalaPath, teaCardMandalaPaths['fresh-green']);
  assert.equal(visual.focusX, 0.25);
  assert.equal(visual.focusY, 0.7);
  assert.equal(visual.scale, 1.9);
  assert.equal(visual.rotationDeg, -6);
});
