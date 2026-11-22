/**
 * P05c read-only pose-catalogue Blob readiness check.
 * No put, del, copy, or automatic recovery. Does not expose pose contents.
 * Run with a configured read token explicitly supplied by the operator.
 */
import { createHash } from 'node:crypto';
import { BlobNotFoundError, get, head, list } from '@vercel/blob';
import { findLatestPoseRevision, YOGI_POSE_REVISION_PREFIX } from '../src/lib/yogiPoseRevisionCore.ts';

const token = process.env.YASURAGI_P05C_READONLY_TOKEN;
const access = process.env.YASURAGI_P05C_READONLY_ACCESS ?? 'private';
if (!token || !['private', 'public'].includes(access)) {
  console.error('STOP: configure YASURAGI_P05C_READONLY_TOKEN and READONLY_ACCESS=private|public; no credentials are printed.');
  process.exit(2);
}
const HEAD = 'yogi/pose-revisions/head-v1.json';
const CANONICAL = 'yogi/poses.json';
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const blobGet = async (path) => {
  const value = await get(path, { token, access });
  if (!value) return null;
  if (value.statusCode !== 200 || !value.stream) throw new Error(`Cannot read ${path}`);
  return { value: JSON.parse(await new Response(value.stream).text()), etag: value.blob.etag };
};
const poseData = async (path) => {
  const result = await blobGet(path);
  if (result && !Array.isArray(result.value)) throw new Error(`Catalogue is not a JSON array: ${path}`);
  return result;
};

try {
  let pointerMeta = null;
  try { pointerMeta = await head(HEAD, { token }); }
  catch (err) { if (!(err instanceof BlobNotFoundError)) throw err; }
  if (pointerMeta) {
    const pointerDoc = await blobGet(HEAD);
    if (!pointerDoc || pointerDoc.etag !== pointerMeta.etag) {
      console.log('BLOCKED: mutable head GET differs from HEAD (probable CDN cache lag); no write is safe.');
      process.exitCode = 1;
    } else {
      const pointer = pointerDoc.value;
      if (!pointer || pointer.format !== 'yogi.pose-head.v1' ||
          typeof pointer.pathname !== 'string' ||
          !pointer.pathname.startsWith(YOGI_POSE_REVISION_PREFIX) ||
          !/^yogi\/pose-revisions\/v1\/[a-zA-Z0-9_.\/-]+\.json$/.test(pointer.pathname) ||
          !/^[a-f0-9]{64}$/.test(pointer.hash)) {
        throw new Error('Invalid authoritative pose head');
      }
      const current = await poseData(pointer.pathname);
      if (!current || digest(current.value) !== pointer.hash) throw new Error('Head referenced missing or mismatched revision');
      const after = await head(HEAD, { token });
      if (after.etag !== pointerMeta.etag) throw new Error('Head changed during read');
      console.log(`PASS: authoritative head consistent; poseCount=${current.value.length}; revisionHash=${pointer.hash.slice(0, 12)}...`);
    }
  } else {
    const latest = await findLatestPoseRevision(async (cursor) => {
      const page = await list({ prefix: YOGI_POSE_REVISION_PREFIX, limit: 1000,
        ...(cursor ? { cursor } : {}), token });
      return { blobs: page.blobs, hasMore: page.hasMore, cursor: page.cursor };
    });
    const revision = latest ? await poseData(latest.pathname) : null;
    const canonical = await poseData(CANONICAL);
    if (!revision && !canonical) throw new Error('No authoritative remote legacy source; bootstrap blocked');
    if (revision && canonical && digest(revision.value) !== digest(canonical.value)) {
      console.log(`BLOCKED: latest immutable revision and canonical Blob diverge (revision count=${revision.value.length}, canonical count=${canonical.value.length}); manual reconciliation required.`);
      process.exitCode = 1;
    } else {
      console.log(`PASS: legacy sources consistent; bootstrap possible after explicit operator review; poseCount=${(revision ?? canonical).value.length}.`);
    }
  }
  console.log('Read-only preflight complete. No Blob objects were created, overwritten, or deleted.');
} catch (error) {
  console.error(`BLOCKED: ${error instanceof Error ? error.message : 'Unknown storage error'}. No data was modified.`);
  process.exitCode = 1;
}
