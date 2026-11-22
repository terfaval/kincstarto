import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import {
  RELEASE_FORMAT, HEAD_FORMAT, PUBLICATION_ID, RELEASE_ID,
  digestRelease, validHead, validRelease, publicSummary, publishedRelease,
  assertPublicationTransition, PublicationConflict,
} from '../src/features/yasuragi/lib/practice-release-core.ts';
import { publicPoseImageUrl, preparePublicPosePreviews } from '../src/features/yasuragi/lib/practice-public-image.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = async (path) => readFile(resolve(root, path), 'utf8');
const releaseId = '1795359000000-123e4567-e89b-12d3-a456-426614174000.json';
const script = { format:'yasuragi.practice.v1', status:'draft', title:'Ellenőrző gyakorlás', practiceId:'test_p06', version:'1.0', durationSec: 900, startNodeId:'start', endNodeId:'END', nodes: [] };
const release = {
  format: RELEASE_FORMAT, releaseId, practiceId:'test_p06', title:'Ellenőrző gyakorlás',
  version:'1.0', durationSec:900, publishedAt:'2026-11-22T15:00:00.000Z', librarySha256:'f'.repeat(64), script, poses:{},
};
const head = {format:HEAD_FORMAT, practiceId:'test_p06', status:'published', releaseId, releaseSha256:digestRelease(release), updatedAt:'2026-11-22T15:00:00.000Z'};

test('P06: valid immutable release and authoritative published pointer', () => {
  assert.equal(PUBLICATION_ID.test('test_p06'),true);
  assert.equal(RELEASE_ID.test(releaseId),true);
  assert.ok(validRelease(release,'test_p06',releaseId));
  assert.ok(validHead(head,'test_p06'));
  assert.deepEqual(publishedRelease(head,release),release);
  assert.deepEqual(Object.keys(publicSummary(release)).sort(), ['durationSec','practiceId','publishedAt','releaseId','title','version'].sort());
});
test('P06: revoked pointer hides release; corrupt fingerprint blocks', () => {
  assert.equal(publishedRelease({...head,status:'revoked'},release),null);
  assert.equal(publishedRelease({...head,releaseSha256:'a'.repeat(64)},release),null);
  assert.equal(publishedRelease(head,{...release,title:'Módosítva'}),null);
  assert.equal(validHead({...head,practiceId:'another'},'test_p06'),false);
  assert.equal(validRelease({...release,practiceId:'another'},'test_p06',releaseId),false);
});
test('P06: state preconditions block replay, stale publish and repeated revoke', () => {
  assert.doesNotThrow(()=>assertPublicationTransition(null,null,'none'));
  assert.doesNotThrow(()=>assertPublicationTransition(head,releaseId,'published'));
  assert.throws(()=>assertPublicationTransition({...head,status:'revoked'},releaseId,'published'),PublicationConflict);
  assert.throws(()=>assertPublicationTransition(head,null,'none'),PublicationConflict);
  assert.throws(()=>assertPublicationTransition(null,releaseId,'published'),PublicationConflict);
});
test('P06: public image source is never the authenticated admin proxy', () => {
  const safe = 'https://abcd.public.blob.vercel-storage.com/pose.webp';
  const proxy = '/api/yogi-knowledge/image-proxy?url='+encodeURIComponent(safe);
  assert.equal(publicPoseImageUrl(proxy),safe);
  assert.equal(publicPoseImageUrl('/yogi-images/original.webp'),'/yogi-images/original.webp');
  assert.equal(publicPoseImageUrl('/api/yogi-knowledge/image-proxy?url='+encodeURIComponent('https://evil.example/pose.webp')),null);
  assert.equal(publicPoseImageUrl('/api/yogi-knowledge/image-proxy?url='+encodeURIComponent('http://abcd.public.blob.vercel-storage.com/x')),null);
  assert.equal(publicPoseImageUrl('/api/yogi-knowledge/image-proxy?url='+encodeURIComponent('https://user:password@abcd.public.blob.vercel-storage.com/x')),null);
  assert.equal(publicPoseImageUrl('/yogi-images/../secret.webp'),null);
  assert.equal(publicPoseImageUrl('/api/admin/yogi-knowledge/image'),null);
});
test('P06: frozen previews only contain required pose IDs and safe public URLs', () => {
  const source = { p1:{id:'p1',name:'P1',imageUrl:'/api/yogi-knowledge/image-proxy?url='+encodeURIComponent('https://abcd.public.blob.vercel-storage.com/image.png')}, p2:{id:'p2',name:'Draft',imageUrl:''} };
  const filtered = preparePublicPosePreviews(source,['p1']);
  assert.deepEqual(Object.keys(filtered),['p1']);
  assert.match(filtered.p1.imageUrl,/^https:/);
  assert.throws(()=>preparePublicPosePreviews(source,['p1','p2']),/illusztráció/);
  assert.throws(()=>preparePublicPosePreviews(source,['missing']),/Hiányzó/);
});
test('P06: admin endpoint guards publication, stale receipts and revocation with CAS',async()=>{
  const route = await source('src/app/api/admin/yasuragi/practices/publication/route.ts');
  assert.match(route,/requireAdmin\(request\)/);
  assert.match(route,/reviewReceiptIsCurrent\(/);
  assert.match(route,/expectedLibrarySha256/);
  assert.match(route,/requiredPublicationPoses\(/);
  assert.match(route,/preparePublicPosePreviews\(/);
  assert.match(route,/librarySha256: current.librarySha256/);
  assert.match(route,/new PublicationConflict|instanceof PublicationConflict/);
  assert.match(route,/revokePractice\(/);
});
test('P06: public catalogue reads releases only, never private draft store',async()=>{
  const catalog = await source('src/app/yasuragi/page.tsx');
  const detail = await source('src/app/yasuragi/[practiceId]/page.tsx');
  const player = await source('src/app/yasuragi/[practiceId]/play/page.tsx');
  for(const page of [catalog,detail,player]) {
    assert.doesNotMatch(page,/practice-draft-store|practice-approval-store|foldon-dolgozas-prototype\.json/);
    assert.match(page,/force-dynamic/);
  }
  assert.match(catalog,/listCurrentPublicPractices/);
  assert.match(detail,/Indítás/);
  assert.match(player,/publicMode/);
  assert.match(player,/readCurrentPublicPractice/);
  assert.match(player,/fixture=\{false\}/);
  assert.doesNotMatch(catalog,/<YasuragiPrototype/);
});
test('P06: public player hides admin test tools and starts paused',async()=>{
  const player = await source('src/features/yasuragi/components/YasuragiPrototype.tsx');
  assert.match(player,/publicMode \? styles\.publicLayout/);
  assert.match(player,/!publicMode && <aside/);
  assert.match(player,/useState\(false\)/);
});
test('P06: dedicated private publication store and write CAS in local and Blob', async()=>{
  const store = await source('src/features/yasuragi/lib/practice-release-store.ts');
  assert.match(store,/YASURAGI_PUBLICATION_BLOB_TOKEN/);
  assert.match(store,/YASURAGI_PRIVATE_BLOB_TOKEN/);
  assert.match(store,/ifMatch: current\.etag/);
  assert.match(store,/allowOverwrite: false/);
  assert.match(store,/\.lock`/);
  assert.match(store,/await rename\(temp, path\)/);
  assert.match(store,/assertPublicationTransition/);
  assert.match(store,/useCache: false/);
});
test('P06: homepage links to the catalogue, not directly to a player',async()=>{
  const home = await source('src/app/page.tsx');
  assert.match(home,/key: "yasuragi"[\s\S]{0,500}href: "\/yasuragi"/);
  assert.doesNotMatch(home,/href: "\/admin\/yasuragi"/);
});


test('P06: local publish -> catalogue -> revoke -> no direct playback -> re-publish', async () => {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const file = await source('src/features/yasuragi/lib/practice-release-store.ts');
  const compiled = ts.transpileModule(file, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const previous = process.cwd();
  const token = process.env.YASURAGI_PUBLICATION_BLOB_TOKEN;
  const directory = await mkdtemp(join(tmpdir(), 'yas-p06-'));
  const stub = {
    BlobNotFoundError: class BlobNotFoundError extends Error {},
    BlobPreconditionFailedError: class BlobPreconditionFailedError extends Error {},
    get(){ throw new Error('Local test called Blob.get'); },
    head(){ throw new Error('Local test called Blob.head'); },
    list(){ throw new Error('Local test called Blob.list'); },
    put(){ throw new Error('Local test called Blob.put'); },
  };
  try {
    delete process.env.YASURAGI_PUBLICATION_BLOB_TOKEN;
    process.chdir(directory);
    const mod = {exports:{}};
    const localRequire = (name) => name === 'server-only' ? {} : name === '@vercel/blob' ? stub :
      name === './practice-release-core' ? {HEAD_FORMAT, RELEASE_FORMAT, RELEASE_ID, PUBLICATION_ID,
        digestRelease, validHead, validRelease, publicSummary, publishedRelease, assertPublicationTransition, PublicationConflict} : require(name);
    new Function('require','module','exports',compiled)(localRequire,mod,mod.exports);
    const store = mod.exports;
    assert.deepEqual(await store.listPublicPractices(),[]);
    assert.equal(await store.readPublicPractice(script.practiceId),null);
    const first = await store.publishPractice({ script, poses:{}, librarySha256:'f'.repeat(64) });
    assert.equal((await store.readPublicPractice(script.practiceId)).releaseId,first.releaseId);
    assert.equal((await store.listPublicPractices()).length,1);
    const status = await store.readPublicationStatus(script.practiceId);
    assert.equal(status.status,'published');
    await store.revokePractice(script.practiceId,first.releaseId);
    assert.equal(await store.readPublicPractice(script.practiceId),null);
    assert.deepEqual(await store.listPublicPractices(),[]);
    assert.equal((await store.readPublicationStatus(script.practiceId)).status,'revoked');
    await assert.rejects(store.revokePractice(script.practiceId,first.releaseId),PublicationConflict);
    const again = await store.publishPractice({ script:{...script,version:'1.1'},poses:{}, librarySha256:'f'.repeat(64) });
    assert.notEqual(again.releaseId,first.releaseId);
    assert.equal((await store.readPublicPractice(script.practiceId)).version,'1.1');
    assert.equal((await store.listPublicPractices()).length,1);
  } finally {
    process.chdir(previous);
    if (token === undefined) delete process.env.YASURAGI_PUBLICATION_BLOB_TOKEN;
    else process.env.YASURAGI_PUBLICATION_BLOB_TOKEN = token;
    await rm(directory,{recursive:true,force:true});
  }
});

test('P06: simulated private Blob CAS publishes only one concurrent head, then revoke hides it', async () => {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const raw = await source('src/features/yasuragi/lib/practice-release-store.ts');
  const compiled = ts.transpileModule(raw, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const token = process.env.YASURAGI_PUBLICATION_BLOB_TOKEN;
  const objects = new Map();
  let index = 0;
  class NotFound extends Error {}
  class Conflict extends Error {}
  const blob = {
    BlobNotFoundError: NotFound,
    BlobPreconditionFailedError: Conflict,
    async head(pathname) {
      const value = objects.get(pathname);
      if (!value) throw new NotFound();
      return { pathname, etag:value.etag };
    },
    async get(pathname) {
      const value = objects.get(pathname);
      return value ? { statusCode:200, stream:new Response(value.raw).body, blob:{ pathname,etag:value.etag } } : null;
    },
    async list({prefix,limit,cursor}) {
      const keys = [...objects.keys()].filter(x=>x.startsWith(prefix)).sort();
      const at = Number(cursor??0); const page = keys.slice(at,at+limit); const after = at+page.length;
      return {blobs:page.map(pathname=>({pathname})),hasMore:after<keys.length,cursor:after<keys.length?String(after):undefined};
    },
    async put(pathname,raw,{allowOverwrite=false,ifMatch}={}) {
      const old = objects.get(pathname);
      if ((old && !allowOverwrite) || (old && old.etag!==ifMatch) || (!old && ifMatch)) throw new Conflict();
      const etag = `e${++index}`;
      objects.set(pathname,{raw,etag});
      return {pathname,url:`https://test.example/${pathname}`,etag};
    },
  };
  try {
    process.env.YASURAGI_PUBLICATION_BLOB_TOKEN = 'p06-test-token';
    const mod = {exports:{}};
    const localRequire = name => name==='server-only'?{}:name==='@vercel/blob'?blob:
      name==='./practice-release-core'?{HEAD_FORMAT, RELEASE_FORMAT, RELEASE_ID, PUBLICATION_ID,
        digestRelease, validHead, validRelease, publicSummary, publishedRelease, assertPublicationTransition, PublicationConflict}:require(name);
    new Function('require','module','exports',compiled)(localRequire,mod,mod.exports);
    const store = mod.exports;
    assert.deepEqual(await store.listPublicPractices(),[]);
    const replies = await Promise.allSettled([
      store.publishPractice({script,poses:{},librarySha256:'f'.repeat(64)}), store.publishPractice({script:{...script,version:'new'},poses:{},librarySha256:'f'.repeat(64)}),
    ]);
    assert.equal(replies.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(replies.filter(x=>x.status==='rejected').length,1);
    assert.equal((await store.listPublicPractices()).length,1);
    const current = await store.readPublicationStatus('test_p06');
    assert.equal(current.status,'published');
    await store.revokePractice('test_p06',current.releaseId);
    assert.deepEqual(await store.listPublicPractices(),[]);
    assert.equal(await store.readPublicPractice('test_p06'),null);
  } finally {
    if (token===undefined) delete process.env.YASURAGI_PUBLICATION_BLOB_TOKEN;
    else process.env.YASURAGI_PUBLICATION_BLOB_TOKEN=token;
  }
});


test('P06: public catalogue and direct links also gate stale live-library dependencies',async()=>{
  const read = await source('src/features/yasuragi/lib/practice-public-read.ts');
  assert.match(read,/publicReleaseIsCurrent/);
  assert.match(read,/getProjectReview\(/);
  assert.match(read,/digestReviewInput\(gate.libraryFingerprintInput\) === release.librarySha256/);
  assert.match(read,/gate.eligible/);
  const detail = await source('src/app/yasuragi/[practiceId]/page.tsx');
  const player = await source('src/app/yasuragi/[practiceId]/play/page.tsx');
  assert.match(detail,/readCurrentPublicPractice/);
  assert.match(player,/readCurrentPublicPractice/);
});
