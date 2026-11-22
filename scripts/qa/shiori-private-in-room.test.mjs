import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicShioriCatalog } from '../../src/lib/shioriCatalog.ts';
import { mergeShioriPrivateState, publicShioriJson, publicShioriHasPersonalFields } from '../../src/lib/shioriPrivateState.ts';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const admin = read('src/app/admin/page.tsx');
const publicPage = read('src/app/library/page.tsx');
const layout = read('src/app/admin/layout.tsx');
const app = read('src/components/spirit/SpiritLibraryApp.tsx');
const shelf = read('src/components/spirit/ShioriShelf.tsx');
const detail = read('src/components/spirit/ShioriBookDetail.tsx');
const bookPanel = read('src/components/spirit/ShioriPrivateBookPanel.tsx');
const pathPanel = read('src/components/spirit/ShioriPrivatePathPanel.tsx');

function fixture() {
  const book = { id:'b0', title:'Könyv', author:'Szerző', tradition:'vegyes',level:'kezdo',
    summary_short:'Ismertető', recommendation:'Ajánlás',themes:['x'],language:'hu',format:'konyv',status:'olvasatlan' };
  const library = { library_version:'v1', thematic_pills:[{slug:'x',label:'X',short_label:'X',color:'#ffffff'}],
    books:[book], paths:[{id:'p0',title:'Út',items:[{book_id:'b0'}]}] };
  const state = {version:1, books:{b0:{status:'folyamatban',notes:'Belső megjegyzés'}},paths:{p0:{progress:43,comments:{b0:'Belső komment'}}}};
  return { library, state };
}

test('public projection excludes private text, progress, status and path comments', () => {
  const {library,state}=fixture();
  const merged = mergeShioriPrivateState(library,state);
  assert.equal(merged.books[0].notes,'Belső megjegyzés');
  assert.equal(merged.paths[0].progress,43);
  assert.equal(merged.paths[0].items[0].comment,'Belső komment');
  const projected = publicShioriCatalog(merged);
  const json = publicShioriJson(merged);
  assert.equal(projected.books[0].status,'olvasatlan');
  assert.equal(projected.books[0].notes,undefined);
  assert.equal(projected.paths[0].progress,undefined);
  assert.equal(projected.paths[0].items[0].comment,undefined);
  for(const value of ['Belső megjegyzés','Belső komment','folyamatban']){
    assert.ok(!JSON.stringify(projected).includes(value));
    assert.ok(!json.includes(value));
  }
  assert.equal(publicShioriHasPersonalFields(JSON.parse(json)),false);
  assert.equal(projected.books.length,1);
  assert.equal(projected.paths.length,1);
});

test('only admin route loads private values and gates integrated forms', () => {
  assert.match(layout,/isAdminRequest\(\)/);
  assert.match(admin,/loadSpiritLibrary\(\{ includePrivate: true \}\)/);
  assert.match(admin,/privateShioriReady\(\)/);
  assert.match(admin,/if \(!\(await isAdminRequest\(\)\)\) redirect\("\/login"\)/);
  assert.match(admin,/privateEnabled=\{privateEnabled\}/);
  assert.match(publicPage,/publicShioriCatalog\(await loadSpiritLibrary\(\)\)/);
  assert.match(publicPage,/admin=\{false\}/);
  assert.doesNotMatch(publicPage,/includePrivate|readShioriPrivateBlob|ShioriPrivate/);
  assert.match(app,/canManagePrivate = admin && privateEnabled/);
  assert.match(app,/viewLibrary = canManagePrivate && local.source === library \? local.snapshot : library/);
  assert.match(app,/current.source !== library \? current/);
  assert.match(app,/canManagePrivate=\{canManagePrivate\}/);
  assert.doesNotMatch(app,/href="\/admin\/shiori-state"/);
  assert.match(detail,/\{canManagePrivate && onBookSaved && \(/);
  assert.match(shelf,/\{canManagePrivate && collection.kind === "path" && currentPath && onPathSaved && \(/);
});

test('book and path panels save exclusively to admin-authenticated private routes', () => {
  const statusRoute = read('src/app/api/admin/spirit/status/route.ts');
  const pathRoute = read('src/app/api/admin/spirit/path/route.ts');
  assert.match(statusRoute,/requireAdmin\(request\)/);
  assert.match(statusRoute,/updateShioriPrivateBlob/);
  assert.match(statusRoute,/privateShioriReady\(\)/);
  assert.match(pathRoute,/requireAdmin\(request\)/);
  assert.match(pathRoute,/updateShioriPrivateBlob/);
  assert.match(bookPanel,/fetch\("\/api\/admin\/spirit\/status"/);
  assert.match(pathPanel,/fetch\("\/api\/admin\/spirit\/path"/);
  assert.doesNotMatch(bookPanel+pathPanel,/\/api\/admin\/spirit\/json|writeSpiritJsonBlob|BLOB_READ_WRITE_TOKEN/);
  assert.match(bookPanel,/setLocked\(true\)/);
  assert.match(pathPanel,/setLocked\(true\)/);
  assert.match(bookPanel,/notes/);
  assert.match(pathPanel,/itemComment/);
});
