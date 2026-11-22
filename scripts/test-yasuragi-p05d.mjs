import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { allowedOptions, chosenOption, validatePrototypeScript } from '../src/features/yasuragi/lib/practice-engine.ts';
import { HISTORY_PAGE_SIZE, blobHistoryCursor, localHistoryCursor, localHistoryPage, nextBlobHistoryCursor, HistoryCursorError } from '../src/features/yasuragi/lib/practice-history.ts';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const ID = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;
const POS = { pose_a: { id: 'pose_a', imageUrl: '/a.png', validated: true } };

function serverModule(path, blob) {
  const source = require('node:fs').readFileSync(join(root, path), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const module = { exports };
  const localRequire = (name) => name === 'server-only' ? {} : name === '@vercel/blob' ? blob : name === './practice-history'
    ? { HISTORY_PAGE_SIZE, blobHistoryCursor, localHistoryCursor, localHistoryPage, nextBlobHistoryCursor } : name === './practice-publication' ? { YASURAGI_REVIEW_FORMAT: 'yasuragi.practice-review.v1' } : require(name);
  new Function('require', 'module', 'exports', compiled)(localRequire, module, exports);
  return module.exports;
}

function ids(n) {
  return Array.from({ length: n }, (_, i) => `${String(1700000000000 + i)}-${randomUUID()}.json`);
}

async function fixtureStore(n) {
  const dir = await mkdtemp(join(tmpdir(), 'yas-p05d-'));
  const drafts = join(dir, 'private/yasuragi-practice-drafts');
  const draftIds = ids(n);
  const receiptIds = ids(n);
  const approval = join(dir, 'private/yasuragi-practice-reviews', draftIds[0].slice(0, -5));
  await mkdir(drafts, { recursive: true });
  await mkdir(approval, { recursive: true });
  const objects = new Map();
  for (let i=0; i<n; i++) {
    const script = { practiceId: `practice_${i}`, title: `Teszt ${i}`, version: 'v1', durationSec: 900, nodes: [] };
    const sha256 = createHash('sha256').update(JSON.stringify(script)).digest('hex');
    const draft = { draftId: draftIds[i], createdAt: new Date(1700000000000 + i).toISOString(), sha256, script };
    const rawDraft = JSON.stringify(draft);
    await writeFile(join(drafts, draftIds[i]), rawDraft);
    objects.set(`yasuragi/practice-drafts/${draftIds[i]}`, rawDraft);
    const receipt = { format: 'yasuragi.practice-review.v1', receiptId: receiptIds[i], draftId: draftIds[0],
      scriptSha256: 'a'.repeat(64), librarySha256: 'b'.repeat(64), createdAt: draft.createdAt,
      attestations: { scriptReviewed: true, movementReviewed: true, previewChecked: true }, kind: 'editorial-signoff' };
    const rawReceipt = JSON.stringify(receipt);
    await writeFile(join(approval, receiptIds[i]), rawReceipt);
    objects.set(`yasuragi/practice-reviews/${draftIds[0].slice(0, -5)}/${receiptIds[i]}`, rawReceipt);
  }
  const blob = {
    list: async ({ prefix, limit, cursor }) => {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const selected = keys.slice(start, start + limit);
      const stop = start + selected.length;
      return { blobs: selected.map((pathname) => ({ pathname })), hasMore: stop < keys.length,
        cursor: stop < keys.length ? String(stop) : undefined };
    },
    get: async (pathname) => objects.has(pathname) ? { statusCode: 200, stream: new Response(objects.get(pathname)).body,
      blob: { pathname } } : null,
    put: () => { throw new Error('Read-only unit test attempted a Blob write.'); },
  };
  return { dir, draftIds: draftIds.sort(), receiptIds: receiptIds.sort(), blob };
}

async function pages(call) {
  const seen = [];
  let cursor = null;
  for (let count = 0; count < 20; count++) {
    const result = await call(cursor);
    assert.ok(result.items.length <= HISTORY_PAGE_SIZE);
    seen.push(...result.items);
    if (!result.hasMore) { assert.equal(result.nextCursor, null); return seen; }
    assert.ok(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('History cursor did not terminate.');
}

test('P05d: default missing is not silently replaced with another option', () => {
  const decision = { id: 'D', type: 'decision', name: 'Döntés', startGlobalSec: 0, durationSec: 30,
    defaultOptionId: 'default', options: [
      { id: 'default', imagePoseId: 'missing', nextNodeId: 'A' },
      { id: 'alternate', imagePoseId: 'pose_a', nextNodeId: 'B' },
    ] };
  assert.equal(allowedOptions(decision, POS).length, 1);
  assert.equal(chosenOption(decision, {}, POS), null);
  assert.equal(chosenOption(decision, { D: 'alternate' }, POS)?.id, 'alternate');
  const script = { startNodeId: 'D', endNodeId: 'END', durationSec: 60, nodes: [decision,
    { id:'A', type:'segment', startGlobalSec:30, durationSec:30, posePool:['pose_a'], defaultPoseId:'pose_a',
      nextNodeId:'END', cues:[], poseVariants:{pose_a:{t:{full:'A',mini:'A'}}} },
    { id:'B', type:'segment', startGlobalSec:30, durationSec:30, posePool:['pose_a'], defaultPoseId:'pose_a',
      nextNodeId:'END', cues:[], poseVariants:{pose_a:{t:{full:'B',mini:'B'}}} },
  ]};
  assert.match(validatePrototypeScript(script, POS).join(' | '), /kötelező alapág nem elérhető/);
});

test('P05d: missing default segment image prevents preview', () => {
  const segment = { id:'start', type:'segment', startGlobalSec:0, durationSec:60, defaultPoseId:'pose_a',
    posePool:['pose_a'], poseVariants:{pose_a:{t:{full:'A',mini:'A'}}}, cues:[], nextNodeId:'END' };
  const script = { startNodeId:'start', endNodeId:'END', durationSec:60, nodes:[segment] };
  assert.match(validatePrototypeScript(script, {pose_a:{...POS.pose_a,imageUrl:''}}).join(' | '), /nincs elérhető illusztrációja/);
  assert.deepEqual(validatePrototypeScript(script, POS), []);
});

test('P05d: local cursor never accepts Blob cursor; 135 IDs traverse exactly once', () => {
  const all = ids(135);
  let cursor;
  const seen = [];
  for (let n=0;n<10;n++) {
    const page = localHistoryPage(all, cursor ? localHistoryCursor(cursor, ID) : undefined);
    seen.push(...page.items);
    cursor = page.nextCursor;
    if (!page.hasMore) break;
  }
  assert.equal(new Set(seen).size,135);
  assert.equal(seen.length,135);
  assert.throws(() => localHistoryCursor('blob:invalid', ID), HistoryCursorError);
  assert.throws(() => blobHistoryCursor('local:invalid'), HistoryCursorError);
  assert.equal(blobHistoryCursor('blob:opaque-token'), 'opaque-token');
  assert.equal(nextBlobHistoryCursor(true, 'abc'), 'blob:abc');
});

test('P05d: local private drafts + approvals paginate beyond 100 without mutation', async () => {
  const store = await fixtureStore(135);
  const previous = process.cwd();
  try {
    process.chdir(store.dir);
    const drafts = serverModule('src/features/yasuragi/lib/practice-draft-store.ts', store.blob);
    const approval = serverModule('src/features/yasuragi/lib/practice-approval-store.ts', store.blob);
    const seen = await pages((cursor) => drafts.listPracticeDrafts(cursor));
    assert.deepEqual(seen.map((x)=>x.draftId),store.draftIds);
    const receipts = await pages((cursor) => approval.listReviewReceipts(store.draftIds[0], cursor));
    assert.deepEqual(receipts.map((x)=>x.receiptId), store.receiptIds);
    const latest = await approval.latestReviewReceipt(store.draftIds[0]);
    assert.equal(latest.receiptId,store.receiptIds.at(-1));
  } finally { process.chdir(previous); await rm(store.dir,{recursive:true,force:true}); }
});

test('P05d: mocked private Blob history paginates and finds newest receipt over 100 entries', async () => {
  const store = await fixtureStore(135);
  const old = process.env.YASURAGI_PRIVATE_BLOB_READ_WRITE_TOKEN;
  try {
    process.env.YASURAGI_PRIVATE_BLOB_READ_WRITE_TOKEN = 'p05d-fake-private-token';
    const drafts = serverModule('src/features/yasuragi/lib/practice-draft-store.ts', store.blob);
    const approval = serverModule('src/features/yasuragi/lib/practice-approval-store.ts', store.blob);
    const foundDrafts = await pages((cursor) => drafts.listPracticeDrafts(cursor));
    assert.deepEqual(foundDrafts.map((x)=>x.draftId),store.draftIds);
    const foundReceipts = await pages((cursor) => approval.listReviewReceipts(store.draftIds[0], cursor));
    assert.deepEqual(foundReceipts.map((x)=>x.receiptId),store.receiptIds);
    assert.equal((await approval.latestReviewReceipt(store.draftIds[0])).receiptId,store.receiptIds.at(-1));
  } finally {
    if (old === undefined) delete process.env.YASURAGI_PRIVATE_BLOB_READ_WRITE_TOKEN;
    else process.env.YASURAGI_PRIVATE_BLOB_READ_WRITE_TOKEN = old;
    await rm(store.dir,{recursive:true,force:true});
  }
});

test('P05d: admin endpoints and pages enforce private access; no public draft catalogue', async () => {
  for (const path of ['src/app/admin/yasuragi/page.tsx','src/app/admin/yasuragi/practices/page.tsx']) {
    assert.match(await readFile(join(root,path),'utf8'), /await isAdminRequest\(\)/);
  }
  for (const path of ['src/app/api/admin/yasuragi/practices/route.ts','src/app/api/admin/yasuragi/practices/approval/route.ts']) {
    const source = await readFile(join(root,path),'utf8');
    assert.match(source, /await requireAdmin\(/);
    assert.match(source, /private, no-store/);
    assert.match(source, /HistoryCursorError/);
  }
  const authoring = await readFile(join(root,'src/features/yasuragi/lib/practice-authoring.ts'),'utf8');
  assert.match(authoring, /validatePrototypeScript\(script, livePoses\)/);
  const home = await readFile(join(root,'src/app/page.tsx'),'utf8');
  assert.match(home, /key: "yasuragi"[\s\S]*?href: null/);
});
