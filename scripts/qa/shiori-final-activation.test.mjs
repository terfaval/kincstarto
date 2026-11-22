import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditShioriActivation } from './shiori-activation-audit-core.mjs';
import {
  extractShioriPrivateState, mergeShioriPrivateState,
  publicShioriHasPersonalFields, publicShioriJson, validateShioriPrivateState,
} from '../../src/lib/shioriPrivateState.ts';

const read = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const helpers = {
  validateLibrary: (raw) => ({ ...raw, books: raw.books.map((book) => ({status:'olvasatlan',...book})) }),
  validateState: validateShioriPrivateState,
  extract: extractShioriPrivateState,
  merge: mergeShioriPrivateState,
  publicJson: publicShioriJson,
  hasPersonal: publicShioriHasPersonalFields,
};
function fixture() {
  const original = {
    library_version: 'v2', thematic_pills: [{slug:'all',label:'Összes',short_label:'Mind',color:'#123456'}],
    books: Array.from({length:94}, (_,n) => ({
      id: `b${n}`, title:`Cím ${n}`, author:`Szerző ${n}`, tradition:'vegyes',level:'kezdo',
      summary_short:'Leírás',recommendation:'Ajánlás',themes:['all'],language:'hu',format:'konyv',
      status: n < 22 ? 'folyamatban' : 'olvasatlan',
      ...(n < 10 ? { notes:`Belső jegyzet ${n}` } : {}),
    })),
    paths: Array.from({length:8},(_,n) => ({id:`p${n}`,title:`Út ${n}`,items:[{book_id:`b${n}`}],progress: n*10})),
  };
  return { publicRaw: publicShioriJson(original), privateState: extractShioriPrivateState(original), original };
}
test('complete postcheck proves canonical 94/8 and all private values', () => {
  const {publicRaw, privateState, original} = fixture();
  const report = auditShioriActivation(publicRaw, privateState, helpers);
  assert.equal(report.postcheckPassed, true);
  assert.equal(report.books, 94);assert.equal(report.paths, 8);
  assert.equal(report.statuses, 22);assert.equal(report.adminEditorialNotes, 10);
  assert.equal(report.pathProgress, 8);
  assert.deepEqual(JSON.parse(publicRaw).paths.map(p=>p.items),original.paths.map(p=>p.items.map(({book_id})=>({book_id}))));
});
test('postcheck refuses any public personal status or notes', () => {
  const {publicRaw, privateState}=fixture();
  const bad = JSON.parse(publicRaw); bad.books[0].status = 'folyamatban';
  assert.throws(()=>auditShioriActivation(JSON.stringify(bad),privateState,helpers));
  delete bad.books[0].status; bad.books[0].notes = 'PRIVÁT';
  assert.throws(()=>auditShioriActivation(JSON.stringify(bad),privateState,helpers));
});
test('postcheck refuses a missing book, path, noncanonical editorial edit or unknown schema key', () => {
  const {publicRaw, privateState}=fixture();
  for (const mutation of [
    x=>{x.books.pop()}, x=>{x.paths.pop()},x=>{x.books[0].title='Másik cím'},x=>{x.extra='hidden'},
  ]) {
    const changed = JSON.parse(publicRaw);mutation(changed);
    assert.throws(()=>auditShioriActivation(JSON.stringify(changed),privateState,helpers));
  }
});
test('postcheck refuses missing state values, orphan private IDs and mismatched path comments', () => {
  const {publicRaw,privateState}=fixture();
  for(const mutate of [
    x=>{delete x.books.b0.status},
    x=>{x.books.orphan={status:'folyamatban'}},
    x=>{x.paths.p0.comments={orphan:'belső'}},
    x=>{delete x.paths.p7.progress},
    x=>{delete x.books.b5.notes},
  ]) {
    const changed=JSON.parse(JSON.stringify(privateState)); mutate(changed);
    assert.throws(()=>auditShioriActivation(publicRaw,changed,helpers));
  }
});
test('activation route is read-only and admin protected, never returns personal values', () => {
  const route=read('src/app/api/admin/spirit/private-activation-check/route.ts');
  assert.match(route,/requireAdmin\(\)/);
  assert.match(route,/export async function GET\(/);
  assert.doesNotMatch(route,/export async function (POST|PATCH|DELETE|PUT)\(/);
  assert.doesNotMatch(route,/\bput\(|\bdel\(|console\.log|console\.error/);
  assert.match(route,/"NO_WRITES"/);
  assert.match(route,/readShioriPrivateBlob/);
  assert.match(route,/readSpiritJsonBlob/);
  assert.match(route,/expectedPublicSha256: expected.publicSha256/);
  assert.match(route,/phase: "POST_REDACTION"/);
});
test('authenticated admin page integrates private fields; public page remains projected', () => {
  const admin=read('src/app/admin/page.tsx');
  const layout=read('src/app/admin/layout.tsx');
  const publicPage=read('src/app/library/page.tsx');
  const mainApp=read('src/components/spirit/SpiritLibraryApp.tsx');
  assert.match(layout,/isAdminRequest\(\)/);
  assert.match(admin,/privateShioriReady\(\)/);
  assert.match(admin,/loadSpiritLibrary\(\{ includePrivate: true \}\)/);
  assert.match(admin,/privateEnabled=\{privateEnabled\}/);
  assert.match(mainApp,/canManagePrivate = admin && privateEnabled/);
  assert.doesNotMatch(mainApp,/Link href="\/admin\/shiori-state"/);
  assert.match(publicPage,/publicShioriCatalog\(await loadSpiritLibrary\(\)\)/);
  assert.match(publicPage,/admin=\{false\}/);
  assert.doesNotMatch(publicPage,/includePrivate|shiori-state/);
});
