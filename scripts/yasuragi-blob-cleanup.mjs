#!/usr/bin/env node
/**
 * Explicit, guarded cleanup of old Yasuragi images. DRY RUN by default.
 * Refuses deletion unless all candidate files were verified in a local backup.
 * To run with writes, supply --apply --confirm YES_DELETE_UNREFERENCED --max-delete N.
 * Only obsolete mannequin_* files are eligible for batch cleanup; other image categories stay protected.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyBackup } from './yasuragi-blob-backup.mjs';

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i+1] : undefined; }

// Keep anatomy illustrations, iconic references and newly uploaded non-mannequin artwork out
// of the bulk cleanup even if none of the current yogi JSON documents mentions them.
function isOldMannequinImage(pathname) {
  return /^yogi\/images\/[^/]+\/mannequin_(?:angled|front|side|image)-[^/]+\.(?:png|webp|jpe?g)$/i.test(pathname);
}

function normalizedEtag(value) {
  return typeof value === 'string' ? value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '') : '';
}

function jsonMentions(value, url) {
  if (typeof value === 'string') return value.includes(url);
  if (Array.isArray(value)) return value.some(v=>jsonMentions(v,url));
  if (value && typeof value === 'object') return Object.values(value).some(v=>jsonMentions(v,url));
  return false;
}

/**
 * Read a current JSON document without ever switching a public Blob to private.
 * The public Blob SDK does not accept useCache:false; that option is used only
 * for private objects. Confirm GET content against list and two origin HEADs,
 * failing closed if a public CDN response is stale or an update races the read.
 */
async function fetchJson(blob, entry, token) {
  const { pathname, url, etag } = entry;
  const access = typeof url === 'string' && url.includes('.private.blob.vercel-storage.com/')
    ? 'private' : 'public';
  if (typeof blob.head !== 'function') throw new Error(`Cannot revalidate live JSON: ${pathname} (head unavailable)`);
  const before = await blob.head(pathname, { token });
  if (!etag || !before?.etag || normalizedEtag(before.etag) !== normalizedEtag(etag)) {
    throw new Error(`Live JSON changed since listing: ${pathname}`);
  }
  const options = { access, token };
  if (access === 'private') options.useCache = false;
  let response;
  try {
    response = await blob.get(pathname, options);
  } catch (error) {
    throw new Error(`Could not read live JSON ${pathname} (${access}): ${error.message}`);
  }
  if (response?.statusCode !== 200 || !response.stream) {
    throw new Error(`Could not read live JSON ${pathname}: expected a 200 response with a body`);
  }
  const raw = await new Response(response.stream).text();
  const after = await blob.head(pathname, { token });
  const received = response.blob?.etag;
  const expected = normalizedEtag(etag);
  if (!expected || !received || !after?.etag || normalizedEtag(received) !== expected || normalizedEtag(after.etag) !== expected) {
    throw new Error(`Live JSON ETag mismatch (stale or concurrently modified): ${pathname}`);
  }
  if (Number.isFinite(before.size) && Buffer.byteLength(raw) !== before.size) {
    throw new Error(`Live JSON size mismatch: ${pathname}`);
  }
  try { return JSON.parse(raw); }
  catch (error) { throw new Error(`Invalid live JSON ${pathname}: ${error.message}`); }
}

async function listAll(blob, token) {
  let cursor;const entries=[];
  do {
    const r=await blob.list({prefix:'yogi/',limit:1000,...(cursor?{cursor}:{}),token});
    if (!Array.isArray(r.blobs)) throw new Error('Malformed list() response');
    entries.push(...r.blobs);
    if (!r.hasMore) break;
    if (!r.cursor || r.cursor === cursor) throw new Error('Pagination did not advance');
    cursor=r.cursor;
  } while (true);
  return entries;
}

export async function planCleanup({blob, token, backupDir, log=console.log}) {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not set');
  if (!backupDir) throw new Error('Specify --backup <verified-backup-directory>');
  const verified=await verifyBackup(backupDir,{log});
  if (verified.missing) throw new Error('Backup has missing referenced assets. Cleanup refused.');
  const manifest=JSON.parse(await readFile(join(resolve(backupDir),'manifest.json'),'utf8'));
  const backed=new Map(manifest.entries.map(x=>[x.pathname,x]));
  const remote=await listAll(blob,token);
  const jsonEntries=remote.filter(x=>x.pathname.endsWith('.json'));
  if (!jsonEntries.some(x=>x.pathname==='yogi/poses.json')) throw new Error('Missing live yogi/poses.json. Refusing cleanup.');
  // Read all Yasuragi JSON from the live store, not a potentially stale local ZIP.
  const docs=[];
  for (const entry of jsonEntries) docs.push({path:entry.pathname,body:await fetchJson(blob,entry,token)});
  const images=remote.filter(x=>x.pathname.startsWith('yogi/images/'));
  const candidates=[];
  const retained=[];
  for (const obj of images) {
    const reference=docs.find(doc=>jsonMentions(doc.body,obj.url));
    const backupEntry=backed.get(obj.pathname);
    if (reference) {retained.push({pathname:obj.pathname,reason:`Referenced by ${reference.path}`});continue;}
    if (!isOldMannequinImage(obj.pathname)) {retained.push({pathname:obj.pathname,reason:'Protected: not an old mannequin image'});continue;}
    if (!backupEntry) {retained.push({pathname:obj.pathname,reason:'Not included in verified backup'});continue;}
    if (!normalizedEtag(backupEntry.etag) || !normalizedEtag(obj.etag) || normalizedEtag(backupEntry.etag)!==normalizedEtag(obj.etag) || backupEntry.url!==obj.url) {
      retained.push({pathname:obj.pathname,reason:'Changed since verified backup'});continue;
    }
    candidates.push({pathname:obj.pathname,url:obj.url,etag:obj.etag,size:obj.size});
  }
  candidates.sort((a,b)=>a.pathname.localeCompare(b.pathname));
  retained.sort((a,b)=>a.pathname.localeCompare(b.pathname));
  const result={
    generatedAt:new Date().toISOString(),backupCreatedAt:manifest.createdAt,
    totalLiveImages:images.length,deleteCount:candidates.length,
    reclaimBytes:candidates.reduce((s,c)=>s+c.size,0),candidates,retained,
  };
  log(`DRY RUN: ${images.length} live images; ${candidates.length} backed-up, unreferenced candidates (${result.reclaimBytes} bytes)`);
  return result;
}

export async function applyCleanup({blob,token,backupDir,maxDelete,log=console.log}) {
  if (!Number.isSafeInteger(maxDelete) || maxDelete < 1 || maxDelete > 250) throw new Error('Specify a valid --max-delete between 1 and 250');
  const plan=await planCleanup({blob,token,backupDir,log});
  const removed=[];
  // Check current list and all referenced JSON again before EACH deletion.
  for (const candidate of plan.candidates.slice(0,maxDelete)) {
    if (!isOldMannequinImage(candidate.pathname)) throw new Error('Refusing protected file: '+candidate.pathname);
    const current=await listAll(blob,token);
    const entry=current.find(x=>x.pathname===candidate.pathname);
    if (!entry || entry.url!==candidate.url || normalizedEtag(entry.etag)!==normalizedEtag(candidate.etag)) {
      log(`SKIP image changed: ${candidate.pathname}`);continue;
    }
    const jsonEntries=current.filter(x=>x.pathname.endsWith('.json'));
    if (!jsonEntries.some(x=>x.pathname==='yogi/poses.json')) throw new Error('Missing canonical pose store; cleanup refused');
    let stillUsed=false;
    for (const jsonEntry of jsonEntries) {
      if (jsonMentions(await fetchJson(blob,jsonEntry,token),candidate.url)) {stillUsed=true;break;}
    }
    if (stillUsed) {log(`SKIP newly referenced: ${candidate.pathname}`);continue;}
    const meta=await blob.head(candidate.url,{token});
    if (!meta || meta.pathname!==candidate.pathname || meta.url!==candidate.url || normalizedEtag(meta.etag)!==normalizedEtag(candidate.etag)) {
      log(`SKIP etag mismatch: ${candidate.pathname}`);continue;
    }
    await blob.del(candidate.url,{token,ifMatch:meta.etag});
    log(`DELETED: ${candidate.pathname}`);
    removed.push(candidate.pathname);
  }
  return removed;
}

async function main() {
  const backupDir=arg('--backup');
  const doApply=process.argv.includes('--apply');
  if (doApply && arg('--confirm')!=='YES_DELETE_UNREFERENCED') throw new Error('Permanent deletion requires --confirm YES_DELETE_UNREFERENCED');
  const maxDelete = Number(arg('--max-delete'));
  if (doApply && (!Number.isSafeInteger(maxDelete) || maxDelete < 1 || maxDelete > 250)) throw new Error('Apply requires --max-delete 1..250');
  if (!backupDir) throw new Error('Usage: node scripts/yasuragi-blob-cleanup.mjs --backup <backup-dir> [--apply --confirm YES_DELETE_UNREFERENCED --max-delete N]');
  const sdk=await import('@vercel/blob');
  if (doApply) {
    const deleted=await applyCleanup({blob:sdk,token:process.env.BLOB_READ_WRITE_TOKEN,backupDir,maxDelete});
    console.log(`Deleted ${deleted.length} old images. Re-run dry run to review remaining files.`);
  } else {
    const planned=await planCleanup({blob:sdk,token:process.env.BLOB_READ_WRITE_TOKEN,backupDir});
    const path=join(resolve(backupDir),'cleanup-dry-run.json');
    await writeFile(path,JSON.stringify(planned,null,2)+'\n');
    console.log(`Review the plan BEFORE applying: ${path}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e)=>{console.error('CLEANUP STOPPED:',e.message);process.exitCode=1;});
}
