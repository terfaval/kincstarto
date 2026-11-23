import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KAORI_QA_COUNTS, makeKaoriQAFixture } from '../../src/features/kaori/lib/qaFixture.ts';
import { validateLinks } from '../../src/features/kaori/lib/guards.ts';

test('QA fixtures cover 0, 1, 2, 9, 10 and 11 teas and have valid links', () => {
  assert.deepEqual(KAORI_QA_COUNTS, [0, 1, 2, 9, 10, 11]);
  for (const count of KAORI_QA_COUNTS) {
    const fixture = makeKaoriQAFixture(count);
    assert.equal(fixture.teas.length, count);
    assert.doesNotThrow(() => validateLinks(fixture));
    assert.equal(new Set(fixture.teas.map(t => t.id)).size, count);
    assert.ok(fixture.teas.every(t => t.ingredients.every(i => fixture.ingredients.some(x => x.id === i.ingredientId))));
    assert.ok(fixture.teas.every(t => t.preparationIds.every(id => fixture.preparationProfiles.some(p => p.id === id))));
  }
});
test('11th tea is searchable, and fixtures stay self-contained and fictional', () => {
  const fixture = makeKaoriQAFixture(11);
  assert.equal(fixture.teas.at(-1).id, 'tea_qa_11');
  assert.match(fixture.teas.at(-1).cardLine, /tizenegyedik/);
  assert.ok(fixture.teas.every(t => t.title.startsWith('Teszttea ')));
  assert.ok(fixture.teas.every(t => /nem fogyasztási/i.test(t.modalDescription)));
});
test('multi timer, long timer and different preparation options exist', () => {
  const fixture = makeKaoriQAFixture(2);
  assert.equal(fixture.teas[0].preparationIds.length, 2);
  assert.deepEqual(fixture.preparationProfiles.find(p=>p.id==='profile_qa_multi').steps.map(s=>s.type), ['manual','timer','timer']);
  assert.equal(fixture.preparationProfiles.find(p=>p.teaId==='tea_qa_02').steps[0].durationSeconds, 90000);
  assert.throws(() => makeKaoriQAFixture(12), /Unsupported/);
});
