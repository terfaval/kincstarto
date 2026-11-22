/** Pure, read-only verification of a Shiori 04C/2 local recovery bundle. */
import { createHash, randomUUID } from 'node:crypto';
import { validateLinks } from './shiori-recovery-core.mjs';

export const EXPECTED_LIVE_SHA = 'fc667dcee29223948b9b0b5fa0d7e49af9ebf57dfb6391eee8f739d3dea19a00';
export const EXPECTED_CANDIDATE_SHA = '23840c39cf8815181c0d6940e6f4fab411617835ef1292ecebceab6160abee84';
export const shaObject = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex');
export const shaRaw = (raw) => createHash('sha256').update(raw).digest('hex');

// useCache:false is supported for private Blob reads; public Blob reads use the normal SDK path.
export function blobReadOptions(access) {
  if (access !== 'public' && access !== 'private') throw new Error('Unsupported Blob access mode');
  return access === 'private' ? { access, useCache: false } : { access };
}

function equalJSON(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function invariant(condition, message) { if (!condition) throw new Error(message); }
function mapById(records, label) {
  invariant(Array.isArray(records), `${label} is not an array`);
  const map = new Map();
  for (const item of records) {
    invariant(typeof item?.id === 'string' && item.id && !map.has(item.id), `Invalid/duplicate ID in ${label}`);
    map.set(item.id, item);
  }
  return map;
}

export function verifyRecoveryBundle({ backupRaw, candidateRaw, manifest, liveRaw, expectedLiveSha = EXPECTED_LIVE_SHA, expectedCandidateSha = EXPECTED_CANDIDATE_SHA }) {
  const backup = JSON.parse(backupRaw);
  const candidate = JSON.parse(candidateRaw);
  const live = JSON.parse(liveRaw);
  invariant(manifest?.operation === 'LOCAL_BACKUP_AND_MERGE_PREVIEW_ONLY_NO_BLOB_WRITES', 'Wrong preview manifest operation');
  invariant(manifest.liveFingerprint === expectedLiveSha, 'Manifest live SHA differs from approved audit');
  invariant(manifest.resultFingerprint === expectedCandidateSha, 'Manifest candidate SHA differs from approved dry-run');
  invariant(shaObject(backup) === expectedLiveSha, 'Local backup is not the audited live source');
  invariant(shaRaw(backupRaw) === manifest.liveRawSha256, 'Raw local backup hash mismatch');
  invariant(shaObject(candidate) === expectedCandidateSha, 'Local candidate was changed after the dry-run');
  invariant(shaObject(live) === expectedLiveSha, 'LIVE BLOB HAS CHANGED: no restore or overwrite allowed');
  invariant(backup.library_version === candidate.library_version, 'Library version changed');
  invariant(candidate.books.length === 86 && candidate.paths.length === 8, 'Unexpected candidate book/path counts');
  invariant(backup.books.length === 59 && backup.paths.length === 4, 'Unexpected audited live book/path counts');
  invariant(manifest.report?.originalBooks === 59 && manifest.report?.resultBooks === 86 && manifest.report?.originalPaths === 4 && manifest.report?.resultPaths === 8, 'Manifest totals differ from approved run');
  validateLinks(backup);
  validateLinks(candidate);
  const oldBooks = mapById(backup.books, 'backup.books');
  const newBooks = mapById(candidate.books, 'candidate.books');
  const oldPaths = mapById(backup.paths, 'backup.paths');
  const newPaths = mapById(candidate.paths, 'candidate.paths');
  for (const [id, before] of oldBooks) {
    const after = newBooks.get(id);
    invariant(after, `Original book disappeared: ${id}`);
    // The previously approved merge may only extend related links on shared books.
    for (const [field, value] of Object.entries(before)) {
      if (field !== 'related') invariant(equalJSON(after[field], value), `Existing book field modified: ${id}.${field}`);
    }
    for (const field of Object.keys(after)) {
      if (field !== 'related') invariant(Object.prototype.hasOwnProperty.call(before, field), `Unexpected extra field on existing book ${id}: ${field}`);
    }
    for (const linkedId of before.related || []) invariant((after.related || []).includes(linkedId), `Existing related link removed: ${id} -> ${linkedId}`);
  }
  for (const [id, before] of oldPaths) invariant(equalJSON(newPaths.get(id), before), `Original reading path changed: ${id}`);
  for (const [key, value] of Object.entries(backup.tag_labels || {})) invariant(candidate.tag_labels?.[key] === value, `Original tag label overwritten: ${key}`);
  invariant(candidate.thematic_pills.length >= backup.thematic_pills.length, 'Existing themes were removed');
  for (const pill of backup.thematic_pills) {
    const after = candidate.thematic_pills.find(p => p.slug === pill.slug);
    invariant(equalJSON(after, pill), `Existing thematic pill changed: ${pill.slug}`);
  }
  invariant(newBooks.size - oldBooks.size === 27, 'Added book count is not 27');
  invariant(newPaths.size - oldPaths.size === 4, 'Added path count is not 4');
  invariant((manifest.report.addedBookIds || []).length === 27 && manifest.report.addedPathIds?.length === 4, 'Manifest additions inconsistent');
  for (const id of manifest.report.addedBookIds) invariant(!oldBooks.has(id) && newBooks.has(id), `Manifest added book mismatch: ${id}`);
  for (const id of manifest.report.addedPathIds) invariant(!oldPaths.has(id) && newPaths.has(id), `Manifest added path mismatch: ${id}`);
  return { liveSha: expectedLiveSha, candidateSha: expectedCandidateSha, books: candidate.books.length, paths: candidate.paths.length, addedBooks: 27, addedPaths: 4 };
}

/**
 * Public Blob GET may return a weak HTTP entity tag (W/"hash") while the
 * control-plane HEAD returns the strong equivalent ("hash"). For READ
 * comparisons only, strip precisely the W/ prefix, then compare the complete
 * opaque tag. Never use a weak GET tag as an ifMatch write precondition.
 */
export function comparableETag(tag) {
  if (typeof tag !== 'string') return null;
  const strongForm = tag.startsWith('W/') ? tag.slice(2) : tag;
  return /^"[^"\x00-\x20\x7f]+"$/.test(strongForm) ? strongForm : null;
}

/** Validate CDN bytes against the same logical ETag and origin byte count. */
export function verifyBlobSnapshot({ raw, blob, head, expectedPath = 'spirit/library.json' }) {
  invariant(typeof raw === 'string' && raw.length > 0, 'Empty Blob read');
  invariant(blob?.pathname === expectedPath && head?.pathname === expectedPath, 'Blob pathname mismatch');
  const cdnComparable = comparableETag(blob?.etag);
  const headComparable = comparableETag(head?.etag);
  invariant(cdnComparable && headComparable, 'Missing or malformed Blob ETag');
  invariant(head.etag === headComparable, 'Origin HEAD must provide a strong ETag for conditional write');
  invariant(cdnComparable === headComparable, 'CDN read and origin metadata ETags differ: no write permitted');
  invariant(head.size === Buffer.byteLength(raw, 'utf8'), 'CDN content size differs from origin metadata: no write permitted');
  return head.etag; // Always the unmodified strong origin HEAD ETag for ifMatch.
}

/**
 * Public CDN content may be stale even though head() reports a newer origin version.
 * Retry a read through a unique, documented public-blob URL query parameter.
 * Only return a snapshot if GET content ETag, stable HEAD ETag and byte length agree.
 * No changes to the store are made by this helper.
 */
export async function readVersionCheckedBlob(blobClient, pathname, access, nonce = randomUUID) {
  if (pathname !== 'spirit/library.json') throw new Error('Unexpected recovery object');
  const first = await blobClient.get(pathname, blobReadOptions(access));
  if (first?.statusCode !== 200 || !first.stream) return null;
  const raw = await new Response(first.stream).text();
  const headBefore = await blobClient.head(pathname);
  try {
    const etag = verifyBlobSnapshot({ raw, blob: first.blob, head: headBefore, expectedPath: pathname });
    return { raw, access, etag, metadata: headBefore, cacheBusted: false };
  } catch (error) {
    if (access !== 'public' || !/ETags differ|size differs/.test(String(error?.message))) throw error;
  }

  // HEAD is control-plane metadata; do not trust a query parameter alone as a freshness proof.
  if (headBefore?.pathname !== pathname || !headBefore?.url) throw new Error('Missing HEAD URL for public CDN recheck');
  const url = new URL(headBefore.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
      url.pathname !== `/${pathname}` || url.username || url.password) {
    throw new Error('Unexpected public blob URL; refusing cache-busted verification');
  }
  const nonceValue = nonce();
  if (typeof nonceValue !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(nonceValue)) {
    throw new Error('Invalid nonce for public CDN recheck');
  }
  url.searchParams.set('shiori_verify', nonceValue);
  const fresh = await blobClient.get(url.toString(), blobReadOptions('public'));
  if (fresh?.statusCode !== 200 || !fresh.stream) throw new Error('Cache-busted public Blob read did not return content');
  const freshRaw = await new Response(fresh.stream).text();
  const headAfter = await blobClient.head(pathname);
  if (headAfter?.etag !== headBefore.etag || headAfter?.size !== headBefore.size || headAfter?.pathname !== pathname) {
    throw new Error('Origin Blob version changed during CDN recheck: no write permitted');
  }
  try {
    const etag = verifyBlobSnapshot({ raw: freshRaw, blob: fresh.blob, head: headAfter, expectedPath: pathname });
    return { raw: freshRaw, access, etag, metadata: headAfter, cacheBusted: true };
  } catch (error) {
    // Only hashes and byte counts are reported; do not output document contents or tokens.
    const details = `cdnTagDigest=${shaRaw(String(fresh.blob?.etag ?? '')).slice(0, 12)}, ` +
      `originTagDigest=${shaRaw(String(headAfter.etag)).slice(0, 12)}, ` +
      `cdnBytes=${Buffer.byteLength(freshRaw, 'utf8')}, originBytes=${headAfter.size}`;
    throw new Error(`Public CDN recheck still disagrees with origin metadata (${error.message}; ${details}). No write permitted; do not disable ETag checks.`);
  }
}

/** Enforce a conditional overwrite; an ordinary allowOverwrite without ifMatch is never permitted. */
export function conditionalWriteOptions(access, etag) {
  invariant(access === 'public' || access === 'private', 'Unsupported Blob access mode for write');
  invariant(typeof etag === 'string' && /^"[^"\r\n]+"$/.test(etag), 'Valid quoted ETag required for conditional write');
  return { access, contentType: 'application/json', allowOverwrite: true, ifMatch: etag };
}

export async function conditionalWrite(blobClient, { pathname, raw, access, etag }) {
  invariant(pathname === 'spirit/library.json', 'Unexpected promotion pathname');
  invariant(typeof raw === 'string' && raw.length > 0, 'Empty candidate payload');
  return blobClient.put(pathname, raw, conditionalWriteOptions(access, etag));
}

/** HEAD is not CDN-cached. Full content verification still needs a later CDN GET. */
export function verifyWriteMetadata({ beforeEtag, response, after, candidateRaw, expectedPath = 'spirit/library.json' }) {
  invariant(typeof response?.etag === 'string' && response.etag.length > 2, 'Write returned no ETag; outcome is ambiguous');
  invariant(response.pathname === expectedPath && after?.pathname === expectedPath, 'Written Blob pathname mismatch');
  invariant(response.etag !== beforeEtag, 'Write did not produce a new Blob version');
  invariant(response.etag === after.etag, 'Post-write HEAD does not match returned ETag; investigate before retrying');
  invariant(after.size === Buffer.byteLength(candidateRaw, 'utf8'), 'Written Blob size differs from candidate; investigate before retrying');
  return response.etag;
}
