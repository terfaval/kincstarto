import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReadableStream } from 'node:stream/web';
import { runBackup } from './yasuragi-blob-backup.mjs';
import { planCleanup, applyCleanup } from './yasuragi-blob-cleanup.mjs';

const makeUrl=(path)=>`https://demo.public.blob.vercel-storage.com/${path}`;
const poseUrl=makeUrl('yogi/images/easy/illustration.png');
const orphanUrl=makeUrl('yogi/images/old/mannequin_angled-1.png');
const livePoses=[{id:'pose_easy',mannequin_angled:{asset_ref:poseUrl}}];
function createMock() {
  const entries=new Map([
    ['yogi/poses.json',Buffer.from(JSON.stringify(livePoses))],
    ['yogi/images/easy/illustration.png',Buffer.from('active')],
    ['yogi/images/old/mannequin_angled-1.png',Buffer.from('orphan')],
  ]);
  const deleted=[];
  const reads=[];
  const blob={
    async list(){return {blobs:[...entries].map(([pathname,data])=>({pathname,url:makeUrl(pathname),size:data.length,etag:`etag-${pathname}`})),hasMore:false};},
    async get(pathname,options){
      reads.push({pathname,...options});
      if (options.access === 'public' && ('useCache' in options)) throw new Error('Vercel Blob: Failed to fetch blob: 400 Bad Request');
      if (options.access !== 'public') throw new Error('Invalid access mode for public test blob');
      const data=entries.get(pathname);
      return data?{statusCode:200,blob:{etag:`W/\"etag-${pathname}\"`},stream:new ReadableStream({start(c){c.enqueue(data);c.close();}})}:null;
    },
    async head(value){const pathname=value.startsWith('https://')?new URL(value).pathname.slice(1):value; const url=makeUrl(pathname); const data=entries.get(pathname);return data?{pathname,url,etag:`etag-${pathname}`,size:data.length}:null;},
    async del(url,opts){const pathname=new URL(url).pathname.slice(1);assert.equal(opts.ifMatch,`etag-${pathname}`);deleted.push(pathname);entries.delete(pathname);},
  };
  return {blob,entries,deleted,reads};
}

test('cleanup plan excludes referenced and requires verified backup; apply deletes orphan only',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cleanup-test-'));
  const {blob,deleted}=createMock();
  try {
    const backupDir=join(root,'backup');
    await runBackup({blob,token:'fake',out:backupDir,log:()=>{}});
    const plan=await planCleanup({blob,token:'fake',backupDir,log:()=>{}});
    assert.deepEqual(plan.candidates.map(x=>x.pathname),['yogi/images/old/mannequin_angled-1.png']);
    assert.equal(plan.retained[0].pathname,'yogi/images/easy/illustration.png');
    const result=await applyCleanup({blob,token:'fake',backupDir,maxDelete:1,log:()=>{}});
    assert.deepEqual(result,['yogi/images/old/mannequin_angled-1.png']);
    assert.deepEqual(deleted,result);
  } finally {await rm(root,{recursive:true,force:true});}
});


test('non-mannequin images are protected even if unreferenced, and batch apply requires a limit', async () => {
  const root=await mkdtemp(join(tmpdir(),'cleanup-protect-'));
  const {blob,entries,deleted}=createMock();
  entries.set('yogi/images/old/scientific_image-123.png',Buffer.from('anatomy'));
  entries.set('yogi/images/old/iconic_image-456.png',Buffer.from('iconic'));
  entries.set('yogi/images/old/illustration-abcd.webp',Buffer.from('new'));
  try {
    const backupDir=join(root,'backup');
    await runBackup({blob,token:'fake',out:backupDir,log:()=>{}});
    const plan=await planCleanup({blob,token:'fake',backupDir,log:()=>{}});
    assert.equal(plan.deleteCount,1);
    assert.equal(plan.retained.filter(x=>x.reason.startsWith('Protected:')).length,3);
    await assert.rejects(applyCleanup({blob,token:'fake',backupDir,log:()=>{}}),/max-delete/);
    const applied=await applyCleanup({blob,token:'fake',backupDir,maxDelete:1,log:()=>{}});
    assert.equal(applied.length,1);
    assert.equal(deleted.length,1);
    assert(entries.has('yogi/images/old/scientific_image-123.png'));
  } finally {await rm(root,{recursive:true,force:true});}
});


test('public live JSON is fetched without useCache:false and never retried as private (prevents real 400)',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cleanup-get400-'));
  const {blob,reads}=createMock();
  try {
    const backupDir=join(root,'backup');
    await runBackup({blob,token:'fake',out:backupDir,log:()=>{}});
    reads.length=0;
    const plan=await planCleanup({blob,token:'fake',backupDir,log:()=>{}});
    assert.equal(plan.deleteCount,1);
    assert(reads.some(x=>x.pathname==='yogi/poses.json'));
    assert(reads.every(x=>x.access==='public' && !('useCache' in x)));
  } finally {await rm(root,{recursive:true,force:true});}
});

test('cleanup aborts when a public JSON GET is stale; it cannot delete using stale references',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cleanup-stale-json-'));
  const {blob,deleted}=createMock();
  try {
    const backupDir=join(root,'backup');
    await runBackup({blob,token:'fake',out:backupDir,log:()=>{}});
    const original=blob.get;
    blob.get=async(pathname,opts)=>{
      const r=await original(pathname,opts);
      if (pathname==='yogi/poses.json') r.blob.etag='W/"old-json-revision"';
      return r;
    };
    await assert.rejects(planCleanup({blob,token:'fake',backupDir,log:()=>{}}),/Live JSON ETag mismatch/);
    await assert.rejects(applyCleanup({blob,token:'fake',backupDir,maxDelete:1,log:()=>{}}),/Live JSON ETag mismatch/);
    assert.equal(deleted.length,0);
  } finally {await rm(root,{recursive:true,force:true});}
});
