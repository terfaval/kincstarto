import { createHash } from 'node:crypto';

export const OBJECT_PATH = 'spirit/library.json';
export const PINNED_SHA256 = 'fc667dcee29223948b9b0b5fa0d7e49af9ebf57dfb6391eee8f739d3dea19a00';
export const PINNED_SIZE = 76068;
export const PINNED_UPLOADED_AT = '2026-11-21T02:41:46.000Z';

const sha256 = (str) => createHash('sha256').update(str).digest('hex');
const iso = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
};
const summaryTag = (etag) => ({
  present: typeof etag === 'string' && etag.length > 0,
  length: typeof etag === 'string' ? etag.length : 0,
  quoted: typeof etag === 'string' && /^"[^"\r\n]+"$/.test(etag),
  weak: typeof etag === 'string' && etag.startsWith('W/'),
  fingerprint12: typeof etag === 'string' && etag ? sha256(etag).slice(0, 12) : null,
});

function verifyTargetUrl(blobUrl) {
  const url = new URL(blobUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
      url.pathname !== `/${OBJECT_PATH}` || url.username || url.password || url.search || url.hash) {
    throw new Error('Unexpected Blob URL; refusing to query another object');
  }
  return url;
}

export async function diagnose(client, {
  pinnedSha = PINNED_SHA256,
  pinnedSize = PINNED_SIZE,
  pinnedUpload = PINNED_UPLOADED_AT,
  nonce = () => 'diag-1234567890',
} = {}) {
  const headBefore = await client.head(OBJECT_PATH);
  if (headBefore?.pathname !== OBJECT_PATH || !headBefore.url) throw new Error('Missing or incorrect origin metadata');
  const baseUrl = verifyTargetUrl(headBefore.url);

  const normal = await client.get(OBJECT_PATH, { access: 'public' });
  const freshUrl = new URL(baseUrl);
  const unique = nonce();
  if (typeof unique !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(unique)) throw new Error('Invalid diagnostic nonce');
  freshUrl.searchParams.set('shiori_diagnostic', unique);
  const uniqueRead = await client.get(freshUrl.toString(), { access: 'public' });
  if (normal?.statusCode !== 200 || !normal.stream || uniqueRead?.statusCode !== 200 || !uniqueRead.stream) {
    throw new Error('Public Blob data unavailable (HTTP status not 200)');
  }

  const toEvidence = async (response) => {
    const raw = await new Response(response.stream).text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error('Blob data is not JSON'); }
    return {
      books: Array.isArray(parsed.books) ? parsed.books.length : null,
      paths: Array.isArray(parsed.paths) ? parsed.paths.length : null,
      sha256: sha256(JSON.stringify(parsed)),
      bytes: Buffer.byteLength(raw, 'utf8'),
      etag: response.blob?.etag,
      uploadedAt: iso(response.blob?.uploadedAt),
      cacheAge: response.headers?.get?.('age') || null,
      cacheStatus: response.headers?.get?.('x-vercel-cache') || null,
      lastModifiedHeader: response.headers?.get?.('last-modified') || null,
    };
  };
  const [first, fresh] = await Promise.all([toEvidence(normal), toEvidence(uniqueRead)]);

  // A conditional read is diagnostic only; never treat a 304 as a write authorization.
  const conditional = await client.get(OBJECT_PATH, { access: 'public', ifNoneMatch: headBefore.etag });
  const conditionalStatus = conditional?.statusCode ?? null;
  if (conditionalStatus === 200 && conditional.stream) {
    await new Response(conditional.stream).arrayBuffer();
  }
  if (![200, 304].includes(conditionalStatus)) throw new Error('Conditional public read returned unexpected status');

  const listed = await client.list({ prefix: OBJECT_PATH, limit: 100 });
  const matchingListEntries = (listed?.blobs || []).filter(item => item.pathname === OBJECT_PATH);
  const headAfter = await client.head(OBJECT_PATH);
  const headStable = headBefore.etag === headAfter.etag && headBefore.size === headAfter.size &&
    iso(headBefore.uploadedAt) === iso(headAfter.uploadedAt) && headAfter.pathname === OBJECT_PATH;

  const matching = matchingListEntries.length === 1 ? matchingListEntries[0] : null;
  const listingMatchesHead = !!matching && matching.size === headAfter.size &&
    iso(matching.uploadedAt) === iso(headAfter.uploadedAt);
  const contentMatchesPinned = first.sha256 === pinnedSha && fresh.sha256 === pinnedSha &&
    first.bytes === pinnedSize && fresh.bytes === pinnedSize &&
    first.books === 59 && first.paths === 4 && fresh.books === 59 && fresh.paths === 4;
  const headMatchesPinned = headStable && headAfter.size === pinnedSize &&
    iso(headAfter.uploadedAt) === pinnedUpload && listingMatchesHead;

  const report = {
    mode: 'READ_ONLY_DIAGNOSTIC',
    object: OBJECT_PATH,
    expected: { books: 59, paths: 4, sha256: pinnedSha, bytes: pinnedSize, uploadedAt: pinnedUpload },
    content: {
      normal: { books: first.books, paths: first.paths, sha256: first.sha256, bytes: first.bytes,
        etag: summaryTag(first.etag), uploadedAt: first.uploadedAt,
        age: first.cacheAge, cacheStatus: first.cacheStatus, lastModified: first.lastModifiedHeader },
      uniqueUrl: { books: fresh.books, paths: fresh.paths, sha256: fresh.sha256, bytes: fresh.bytes,
        etag: summaryTag(fresh.etag), uploadedAt: fresh.uploadedAt,
        age: fresh.cacheAge, cacheStatus: fresh.cacheStatus, lastModified: fresh.lastModifiedHeader },
      conditionalWithHeadEtagStatus: conditionalStatus,
    },
    controlPlane: {
      head: { size: headAfter.size, uploadedAt: iso(headAfter.uploadedAt), etag: summaryTag(headAfter.etag) },
      headStable, listingMatchesHead,
    },
    comparisons: {
      getAndHeadEtagEqual: fresh.etag === headAfter.etag,
      twoGetEtagsEqual: first.etag === fresh.etag,
      contentMatchesPinned,
      headMatchesPinned,
    },
    recommendation: !contentMatchesPinned || !headMatchesPinned
      ? 'STOP: live object or content cannot be matched to the audited 59-book baseline; do not overwrite.'
      : fresh.etag === headAfter.etag
        ? 'ETAGS MATCH. This is still read-only; run the protected promotion preflight separately.'
        : 'UNRESOLVED CDN/HEAD ETAG DIFFERENCE. Baseline metadata and bytes match, but this does not authorize a write.',
  };
  return report;
}
