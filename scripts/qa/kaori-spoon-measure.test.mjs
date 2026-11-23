import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenSpoonDisplay } from '../../src/features/kaori/lib/spoonMeasure.ts';

test('known ingredient-specific QA volumes show readable teaspoons', () => {
  assert.equal(kitchenSpoonDisplay(2.4, 1.2), '2 tk');
  assert.equal(kitchenSpoonDisplay(1.6, 0.8), '2 tk');
});
test('tablespoon is three measuring teaspoons, not a mass conversion', () => {
  assert.equal(kitchenSpoonDisplay(3.6, 1.2), '1 ek');
  assert.equal(kitchenSpoonDisplay(4.2, 1.2), '1 ek + ½ tk');
});
test('missing and untrustworthy values fall back to grams', () => {
  assert.equal(kitchenSpoonDisplay(2.4, null), null);
  assert.equal(kitchenSpoonDisplay(2.4, undefined), null);
  assert.equal(kitchenSpoonDisplay(0.01, 1.2), null);
  assert.equal(kitchenSpoonDisplay(0.4, 1.2), null);
  assert.equal(kitchenSpoonDisplay(4, 0), null);
});

test('ingredient conversion evidence must reference a declared source', async () => {
  const { validateLinks } = await import('../../src/features/kaori/lib/guards.ts');
  const ingredient = {id:'ingredient_a', sourceRefs: [], spoonMeasure:{gramsPerLevelTeaspoon:1.2,evidenceUrl:'https://example.org/measurement'}};
  const groups = {ingredients:[ingredient], methods:[{id:'method_a'}], teas:[{id:'tea_one', ingredients:[{ingredientId:'ingredient_a',sharePct:100}],preparationIds:['profile_one']}], preparationProfiles:[{id:'profile_one',teaId:'tea_one',methodId:'method_a'}]};
  assert.throws(()=>validateLinks(groups), /Kanálmértékhez hiányzó/);
  ingredient.sourceRefs.push('https://example.org/measurement');
  assert.doesNotThrow(()=>validateLinks(groups));
});
