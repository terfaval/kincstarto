import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLinks } from '../../src/features/kaori/lib/guards.ts';
import { scaledDose } from '../../src/features/kaori/lib/preparationMath.ts';
function base(){return {
 ingredients:[{id:'ingredient_tea'}], methods:[{id:'method_infuse'}],
 teas:[{id:'tea_one',ingredients:[{ingredientId:'ingredient_tea',sharePct:100}],preparationIds:['profile_one']}],
 preparationProfiles:[{id:'profile_one',teaId:'tea_one',methodId:'method_infuse'}],
};}
test('valid graph with a single ingredient',()=>assert.doesNotThrow(()=>validateLinks(base())));
test('99% or 105% proportions reject',()=>{for(const n of [99,105,99.9]){const g=base();g.teas[0].ingredients[0].sharePct=n;assert.throws(()=>validateLinks(g),/100%/);}});
test('missing ingredients and broken tea references reject',()=>{const g=base();g.teas[0].ingredients[0].ingredientId='missing';assert.throws(()=>validateLinks(g),/Ismeretlen/);const h=base();h.teas[0].preparationIds=['missing'];assert.throws(()=>validateLinks(h),/Érvénytelen/);});
test('duplicate IDs and duplicate preparation pair reject',()=>{const g=base();g.ingredients.push({...g.ingredients[0]});assert.throws(()=>validateLinks(g),/Duplikált/);const h=base();h.preparationProfiles.push({...h.preparationProfiles[0],id:'profile_two'});assert.throws(()=>validateLinks(h),/Duplikált tea-módszer/);});
test('250 ml to 500 ml preserves grams and shares without guessed spoon values',()=>{
 assert.deepEqual(scaledDose(4,250,[60,40],500),{total:8,grams:[4.8,3.2]});
 const result=scaledDose(3.33,250,[33.33,33.33,33.34],500);
 assert.equal(Math.round(result.grams.reduce((a,b)=>a+b,0)*100),Math.round(result.total*100));
 assert.throws(()=>scaledDose(4,250,[105],250),/Érvénytelen/);
});
