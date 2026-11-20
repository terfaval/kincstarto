#!/usr/bin/env node
/**
 * Read-only Vercel Blob backup for Kincstarto/Yasuragi.
 *
 * backup --out <empty-dir>  : list ALL blobs under yogi/, download and verify.
 * verify --dir <backup-dir>: independently rehash everything from the manifest.
 *
 * Deliberately NEVER calls put(), copy(), or del().
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { pathToFileURL } from 'node:url';

const PREFIX = 'yogi/';
const MANIFEST = 'manifest.json';
const FORMAT_VERSION = 1;

function assetSafePath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith(PREFIX) || pathname.includes('\\')) {
    throw new Error(`Invalid blob pathname: ${String(pathname)}`);
  }
  const parts = pathname.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes(':'))) {
    throw new Error(`Unsafe blob pathname: ${pathname}`);
  }
  return join('files', ...parts);
}

async function isNonemptyDirectory(path) {
  try { return (await readdir(path)).length > 0; }
  catch (e) { if (e?.code === 'ENOENT') return false; throw e; }
}

// The Blob list/head API returns the opaque ETag, while a public HTTP GET
// can return the same opaque value as a weak validator: W/"<etag>".
// Strip HTTP presentation (W/ prefix and surrounding quotes) only when
// comparing the opaque value. Preserve the original metadata in the manifest.
// Backup integrity still relies on byte hashing, expected size, and a
// second comparison against the origin catalog at the end of the run.
function normalizedEtag(value) {
  if (typeof value !== 'string') return null;
  let tag = value.trim();
  if (!tag) return null;
  if (tag.startsWith('W/')) tag = tag.slice(2).trim();
  return tag.startsWith('"') && tag.endsWith('"')
    ? tag.slice(1, -1) : tag;
}

async function readObject(adapter, blob, token, attempt = 0) {
  // All objects in a Blob store have one access type; do not switch a
  // public URL to private on retry (that constructs a different URL).
  const access = typeof blob.url === 'string' && blob.url.includes('.private.blob.vercel-storage.com/')
    ? 'private' : 'public';
  const result = await adapter.get(blob.pathname, {
    access, token,
    ...(attempt > 0 && access === 'private' ? { useCache: false } : {}),
  });
  if (result?.statusCode !== 200 || !result.stream) {
    throw new Error(`Cannot read ${blob.pathname}: no HTTP 200 body`);
  }
  return result;
}

async function downloadVerifiedObject(blobApi, item, token, tempFile, log) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    await rm(tempFile, { force: true });
    const hash = createHash('sha256');
    let bytes = 0;
    let response;
    try {
      response = await readObject(blobApi, item, token, attempt);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        log(`RETRY ${attempt + 1}/2: ${item.pathname} (read error: ${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
      continue;
    }
    const digestStream = new Transform({ transform(chunk, encoding, cb) {
      bytes += chunk.length;
      hash.update(chunk);
      cb(null, chunk);
    } });
    try {
      await pipeline(Readable.fromWeb(response.stream), digestStream, createWriteStream(tempFile, { flags: 'wx' }));
      const receivedEtag = response?.blob?.etag || null;
      const listedEtag = item.etag || null;
      const hasMismatch = receivedEtag && listedEtag && normalizedEtag(receivedEtag) !== normalizedEtag(listedEtag);
      let metadata = item;
      if (hasMismatch) {
        if (typeof blobApi.head !== 'function') {
          throw new Error(`ETag mismatch for ${item.pathname} and head() is unavailable`);
        }
        const current = await blobApi.head(item.pathname, { token });
        if (!current?.etag || !current?.pathname || current.pathname !== item.pathname) {
          throw new Error(`Cannot revalidate changed Blob: ${item.pathname}`);
        }
        if (normalizedEtag(current.etag) !== normalizedEtag(receivedEtag)) {
          // The downloaded content may have come from a stale CDN entry,
          // or the origin was updated again while we were downloading.
          throw new Error(`ETag mismatch for ${item.pathname}: list=${listedEtag}, GET=${receivedEtag}, origin=${current.etag}`);
        }
        metadata = current;
        log(`REFRESHED: ${item.pathname} changed since listing; confirmed current version with head()`);
      }
      // Always compare bytes to the origin catalog size, even if the
      // response omits a Content-Length.
      const expectedSize = metadata.size;
      if (Number.isFinite(expectedSize) && bytes !== expectedSize) {
        throw new Error(`Size mismatch for ${item.pathname}: expected ${expectedSize}, got ${bytes}`);
      }
      if (Number.isFinite(response?.blob?.size) && response.blob.size > 0 && bytes !== response.blob.size) {
        throw new Error(`HTTP Content-Length mismatch for ${item.pathname}: expected ${response.blob.size}, got ${bytes}`);
      }
      return { bytes, sha256: hash.digest('hex'), metadata, receivedEtag };
    } catch (error) {
      lastError = error;
      await rm(tempFile, { force: true });
      if (attempt < 2) {
        log(`RETRY ${attempt + 1}/2: ${item.pathname} (${error.message})`);
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  throw new Error(`Could not establish a consistent download for ${item.pathname}. ${lastError?.message}`);
}

async function listEveryBlob(blob, token, log = console.log) {
  const catalog = [];
  let cursor;
  const seen = new Set();
  do {
    const result = await blob.list({ prefix: PREFIX, limit: 1000, ...(cursor ? { cursor } : {}), token });
    if (!Array.isArray(result?.blobs)) throw new Error('Unexpected Blob list response');
    for (const entry of result.blobs) {
      assetSafePath(entry.pathname);
      if (seen.has(entry.pathname)) throw new Error(`Duplicate pathname: ${entry.pathname}`);
      seen.add(entry.pathname);
      catalog.push(entry);
    }
    log(`List: ${catalog.length} objects`);
    if (!result.hasMore) break;
    if (!result.cursor || cursor === result.cursor) throw new Error('Blob pagination did not advance');
    cursor = result.cursor;
  } while (true);
  return catalog.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

export function collectReferences(poses) {
  const refs = [];
  if (!Array.isArray(poses)) throw new Error('poses.json is not an array');
  for (const pose of poses) {
    for (const slot of ['mannequin_front', 'mannequin_angled']) {
      const ref = pose?.[slot]?.asset_ref;
      if (typeof ref === 'string' && ref.trim()) refs.push({ poseId: pose?.id || null, slot, asset_ref: ref });
    }
  }
  return refs;
}

export async function runBackup({ blob, token, out, log = console.log }) {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is missing. Use node --env-file=<temporary-production-env> ...');
  if (!out) throw new Error('Specify --out <new-empty-directory>');
  const dest = resolve(out);
  if (await isNonemptyDirectory(dest)) throw new Error(`Output folder is not empty: ${dest}`);

  const catalog = await listEveryBlob(blob, token, log);
  if (catalog.length === 0) throw new Error('No objects in yogi/. Check that this is the correct production store.');
  if (!catalog.some((item) => item.pathname === 'yogi/poses.json')) {
    throw new Error('Missing yogi/poses.json. Refusing to treat this as a complete production backup.');
  }
  await mkdir(dest, { recursive: true });
  const entries = [];
  let totalBytes = 0;
  for (const [index, item] of catalog.entries()) {
    const rel = assetSafePath(item.pathname);
    const finalFile = join(dest, rel);
    await mkdir(dirname(finalFile), { recursive: true });
    const tempFile = finalFile + '.partial';
    const result = await downloadVerifiedObject(blob, item, token, tempFile, log);
    await rename(tempFile, finalFile);
    const { bytes, sha256, metadata } = result;
    totalBytes += bytes;
    entries.push({ pathname: item.pathname, path: rel.replaceAll('\\', '/'), size: bytes,
      sha256, url: metadata.url || item.url || null, etag: metadata.etag || result.receivedEtag || null,
      uploadedAt: metadata.uploadedAt ? new Date(metadata.uploadedAt).toISOString() :
        (item.uploadedAt ? new Date(item.uploadedAt).toISOString() : null) });
    log(`[${index + 1}/${catalog.length}] ${item.pathname} (${bytes} bytes)`);
  }
  // Prevent silently labelling a moving collection as a single verified snapshot.
  // Never delete partial backups on failure; a fresh run uses a new empty folder.
  const finalCatalog = await listEveryBlob(blob, token, () => {});
  const finalByPath = new Map(finalCatalog.map(item => [item.pathname, item]));
  if (finalCatalog.length !== entries.length) {
    throw new Error(`Store changed while backing up: listed ${entries.length} objects, now ${finalCatalog.length}. Run a fresh backup.`);
  }
  for (const saved of entries) {
    const current = finalByPath.get(saved.pathname);
    if (!current || (saved.etag && current.etag && normalizedEtag(saved.etag) !== normalizedEtag(current.etag))
      || (Number.isFinite(current.size) && current.size !== saved.size)) {
      throw new Error(`Store changed after download: ${saved.pathname}. Run a fresh backup.`);
    }
  }
  const poses = JSON.parse(await readFile(join(dest, 'files', 'yogi', 'poses.json'), 'utf8'));
  const references = collectReferences(poses);
  const knownUrls = new Set(entries.map((v) => v.url).filter(Boolean));
  const unlistedBlobRefs = references.filter((ref) =>
    ref.asset_ref.includes('.blob.vercel-storage.com') && !knownUrls.has(ref.asset_ref));
  const snapshot = {
    formatVersion: FORMAT_VERSION,
    kind: 'kincstarto-yasuragi-vercel-blob-backup',
    createdAt: new Date().toISOString(),
    prefix: PREFIX,
    totalObjects: entries.length,
    totalBytes,
    poseCount: poses.length,
    poseReferences: references,
    unlistedBlobRefs,
    entries,
  };
  await writeFile(join(dest, MANIFEST + '.partial'), JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  await rename(join(dest, MANIFEST + '.partial'), join(dest, MANIFEST));
  const result = await verifyBackup(dest, { log });
  log(`DONE: ${dest} | ${result.objects} objects | ${result.bytes} bytes`);
  if (unlistedBlobRefs.length) log(`WARNING: ${unlistedBlobRefs.length} referenced blob URLs missing from yogi/ listing. No cleanup is safe until checked.`);
  return snapshot;
}

export async function verifyBackup(dir, { log = console.log } = {}) {
  const dest = resolve(dir);
  const manifest = JSON.parse(await readFile(join(dest, MANIFEST), 'utf8'));
  if (manifest.kind !== 'kincstarto-yasuragi-vercel-blob-backup' || manifest.formatVersion !== FORMAT_VERSION || !Array.isArray(manifest.entries)) {
    throw new Error('Unknown or incomplete manifest');
  }
  if (!manifest.entries.length || manifest.entries.length !== manifest.totalObjects) throw new Error('Manifest object-count mismatch');
  let bytes = 0;
  const seen = new Set();
  for (const item of manifest.entries) {
    if (seen.has(item.pathname)) throw new Error(`Duplicate ${item.pathname}`);
    seen.add(item.pathname);
    const rel = assetSafePath(item.pathname);
    if (item.path !== rel.replaceAll('\\', '/')) throw new Error(`Unsafe/mismatched path: ${item.pathname}`);
    const fp = resolve(dest, item.path);
    if (relative(dest, fp).startsWith('..' + sep)) throw new Error(`Escaping backup directory: ${fp}`);
    const file = await open(fp, 'r');
    try {
      const digest = createHash('sha256');
      let size = 0;
      for await (const chunk of file.createReadStream()) { digest.update(chunk); size += chunk.length; }
      if (size !== item.size || digest.digest('hex') !== item.sha256) throw new Error(`Corrupt backup: ${item.pathname}`);
      bytes += size;
    } finally { await file.close(); }
  }
  if (!seen.has('yogi/poses.json')) throw new Error('poses.json missing from backup');
  if (bytes !== manifest.totalBytes) throw new Error('Total byte-count mismatch');
  const poses = JSON.parse(await readFile(join(dest, 'files', 'yogi', 'poses.json'), 'utf8'));
  if (poses.length !== manifest.poseCount) throw new Error('Pose-count mismatch');
  if (JSON.stringify(collectReferences(poses)) !== JSON.stringify(manifest.poseReferences)) throw new Error('Pose reference manifest mismatch');
  log(`VERIFIED: ${manifest.totalObjects} blobs, ${bytes} bytes, ${poses.length} poses`);
  if (manifest.unlistedBlobRefs.length) log(`CAUTION: ${manifest.unlistedBlobRefs.length} external/missing referenced blobs`);
  return { objects: manifest.totalObjects, bytes, poses: poses.length, missing: manifest.unlistedBlobRefs.length };
}

function argValue(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
async function main() {
  const command = process.argv[2];
  if (command === 'backup') {
    const { list, get, head } = await import('@vercel/blob');
    await runBackup({ blob: { list, get, head }, token: process.env.BLOB_READ_WRITE_TOKEN, out: argValue('--out') });
  } else if (command === 'verify') {
    if (!argValue('--dir')) throw new Error('Usage: verify --dir <backup-directory>');
    await verifyBackup(argValue('--dir'));
  } else throw new Error('Usage: node scripts/yasuragi-blob-backup.mjs backup --out <new-directory> | verify --dir <directory>');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error('BACKUP FAILED:', error.message); process.exitCode = 1; });
}
