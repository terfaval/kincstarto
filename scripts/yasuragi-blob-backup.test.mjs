import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReadableStream } from 'node:stream/web';
import { runBackup, verifyBackup } from './yasuragi-blob-backup.mjs';

const poses = [ { id: 'pose_easy_pose', mannequin_front: { asset_ref: null }, mannequin_angled: { asset_ref: 'https://test.public.blob.vercel-storage.com/yogi/images/easy/illustration.png' } } ];
const objects = [
  { pathname: 'yogi/images/easy/illustration.png', url: poses[0].mannequin_angled.asset_ref, data: Buffer.from('test-image-data') },
  { pathname: 'yogi/poses.json', url: 'https://test.public.blob.vercel-storage.com/yogi/poses.json', data: Buffer.from(JSON.stringify(poses)) },
];
const fake = {
  async list({cursor}) { const part = cursor ? objects.slice(1) : objects.slice(0,1); return {blobs: part.map(({pathname,url,data}) => ({ pathname, url, size: data.length, etag: `${data.length}`})), hasMore: !cursor, cursor: cursor ? undefined : 'page2' }; },
  async get(pathname) { const object = objects.find(x=>x.pathname===pathname); return {statusCode:200, blob:{etag:`${object.data.length}`}, stream:new ReadableStream({start(c){c.enqueue(object.data);c.close();}})}; }
};
test('backups all paginated yogi blobs and verifies SHA256', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yasuragi-backup-test-'));
  try {
    const target = join(root,'backup');
    const manifest = await runBackup({ blob: fake, token:'fake', out: target, log:()=>{} });
    assert.equal(manifest.totalObjects,2);
    assert.equal(manifest.poseCount,1);
    assert.equal(manifest.unlistedBlobRefs.length,0);
    assert.equal((await verifyBackup(target,{log:()=>{}})).objects,2);
    const path=join(target,'files/yogi/images/easy/illustration.png');
    await writeFile(path,'corrupted');
    await assert.rejects(verifyBackup(target,{log:()=>{}}),/Corrupt backup/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('will not use nonempty destination or missing token',async()=>{
  const root=await mkdtemp(join(tmpdir(),'yasuragi-backup-test-'));
  try {
    await assert.rejects(runBackup({blob:fake,token:'',out:join(root,'backup'),log:()=>{}}),/TOKEN/);
    await writeFile(join(root,'file.txt'),'bad');
    await assert.rejects(runBackup({blob:fake,token:'fake',out:root,log:()=>{}}),/not empty/);
  } finally {await rm(root,{recursive:true,force:true});}
});

const makeStream = (data) => new ReadableStream({start(c) { c.enqueue(data); c.close(); }});

test('revalidates an object updated between listing and GET using head()', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yasuragi-changed-test-'));
  try {
    const newData = Buffer.from('new-blob-version');
    const listVersion = { pathname: 'yogi/anatomy.json', size: 16, etag: 'old', url: 'https://test.blob.vercel-storage.com/yogi/anatomy.json' };
    const data = [
      { pathname: 'yogi/anatomy.json', size: newData.length, etag: 'new', url: listVersion.url },
      { pathname: 'yogi/poses.json', size: 2, etag: 'pose', url: 'https://test.blob.vercel-storage.com/yogi/poses.json' },
    ];
    let listings=0;
    const adapter={
      async list() { listings++; return {blobs:listings === 1 ? [listVersion,data[1]]:data,hasMore:false}; },
      async get(path) { const d=path === 'yogi/anatomy.json' ? newData:Buffer.from('[]'); return {statusCode:200, blob:{etag:path === 'yogi/anatomy.json'?'new':'pose',size:d.length},stream:makeStream(d)}; },
      async head(path) {assert.equal(path,'yogi/anatomy.json');return data[0];},
    };
    const result=await runBackup({blob:adapter,token:'fake',out:join(root,'backup'),log:()=>{}});
    assert.equal(result.entries[0].etag,'new');
    assert.equal((await verifyBackup(join(root,'backup'),{log:()=>{}})).objects,2);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('does not accept an out-of-date CDN copy and never marks it verified', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yasuragi-stale-test-'));
  try {
    const item = {pathname:'yogi/anatomy.json',size:3,etag:'current',url:'https://test.blob.vercel-storage.com/yogi/anatomy.json'};
    const poses = {pathname:'yogi/poses.json',size:2,etag:'pose',url:'https://test.blob.vercel-storage.com/yogi/poses.json'};
    const adapter={
      async list(){return {blobs:[item,poses],hasMore:false};},
      async get(){return {statusCode:200,blob:{etag:'stale',size:3},stream:makeStream(Buffer.from('old'))};},
      async head(){return item;},
    };
    await assert.rejects(runBackup({blob:adapter,token:'fake',out:join(root,'backup'),log:()=>{}}),/Could not establish a consistent download/);
    await assert.rejects(verifyBackup(join(root,'backup'),{log:()=>{}}),/ENOENT/);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('accepts quoted HTTP ETag matching the listing ETag without unnecessary head()', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yasuragi-quoted-etag-'));
  try {
    const adapter = {
      async list() { return { blobs: objects.map(x => ({ pathname: x.pathname, url: x.url, size: x.data.length, etag: `hash-${x.data.length}` })), hasMore: false }; },
      async get(pathname, options) {
        assert.equal(options.access, 'public');
        const object = objects.find(x=>x.pathname === pathname);
        return { statusCode: 200, blob: { etag: `"hash-${object.data.length}"`, size: object.data.length }, stream: makeStream(object.data) };
      },
      async head() { throw new Error('head() should not run for transport ETag quoting'); }
    };
    const saved = await runBackup({ blob: adapter, token:'fake',out:join(root,'backup'),log:()=>{} });
    assert.equal(saved.totalObjects,2);
    assert.equal((await verifyBackup(join(root,'backup'),{log:()=>{}})).objects,2);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('does not attempt private fetch for a public blob on mismatched ETag', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yasuragi-no-private-fallback-'));
  const targets = [
    { pathname:'yogi/anatomy.json', url:'https://test.public.blob.vercel-storage.com/yogi/anatomy.json', size:3, etag:'origin' },
    { pathname:'yogi/poses.json',url:'https://test.public.blob.vercel-storage.com/yogi/poses.json',size:2,etag:'poses' }
  ];
  let retries = 0;
  try {
    const adapter = {
      async list() { return {blobs:targets,hasMore:false};},
      async get(path,options) {
        assert.equal(options.access,'public');
        retries += 1;
        const data = path === 'yogi/poses.json' ? Buffer.from('[]') : Buffer.from('old');
        return {statusCode:200,blob:{etag:path === 'yogi/poses.json'?'poses':'stale',size:data.length},stream:makeStream(data)};
      },
      async head() { return targets[0]; },
    };
    await assert.rejects(runBackup({blob:adapter,token:'fake',out:join(root,'backup'),log:()=>{}}),/Could not establish a consistent download/);
    assert.equal(retries,3);
  } finally {await rm(root,{recursive:true,force:true});}
});


test('accepts weak HTTP ETag W/"..." when list and origin use the same opaque tag', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yasuragi-weak-etag-'));
  let headCalls = 0;
  try {
    const adapter = {
      async list() { return { blobs: objects.map(x => ({pathname:x.pathname,url:x.url,size:x.data.length,etag:`hash-${x.data.length}`})), hasMore:false }; },
      async get(pathname, options) {
        assert.equal(options.access, 'public');
        const x = objects.find(x=>x.pathname===pathname);
        return {statusCode:200,blob:{etag:`W/"hash-${x.data.length}"`,size:x.data.length},stream:makeStream(x.data)};
      },
      async head() { headCalls++; throw new Error('head() must not be needed for weak/strong HTTP formatting'); }
    };
    const result=await runBackup({blob:adapter,token:'fake',out:join(root,'backup'),log:()=>{}});
    assert.equal(result.totalObjects,2);
    assert.equal(headCalls,0);
    assert.equal((await verifyBackup(join(root,'backup'),{log:()=>{}})).objects,2);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('rejects stale weak HTTP ETag whose opaque value differs from origin', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yasuragi-stale-weak-'));
  const item = {pathname:'yogi/anatomy.json',size:3,etag:'current',url:'https://test.blob.vercel-storage.com/yogi/anatomy.json'};
  const posesRef = {pathname:'yogi/poses.json',size:2,etag:'pose',url:'https://test.blob.vercel-storage.com/yogi/poses.json'};
  try {
    const adapter={
      async list() {return {blobs:[item,posesRef],hasMore:false};},
      async get(pathname, options){
        assert.equal(options.access,'public');
        const data=pathname===item.pathname?Buffer.from('old'):Buffer.from('[]');
        return {statusCode:200,blob:{etag:pathname===item.pathname?'W/"stale"':'W/"pose"',size:data.length},stream:makeStream(data)};
      },
      async head(pathname){assert.equal(pathname,item.pathname);return item;},
    };
    await assert.rejects(runBackup({blob:adapter,token:'fake',out:join(root,'backup'),log:()=>{}}),/Could not establish a consistent download/);
  } finally {await rm(root,{recursive:true,force:true});}
});
