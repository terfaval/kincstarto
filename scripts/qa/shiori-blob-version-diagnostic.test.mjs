import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnose } from './shiori-blob-version-diagnostic-core.mjs';

const content = JSON.stringify({ books: Array.from({length: 59}, (_, i) => ({ id: `book-${i}` })), paths: Array.from({length: 4}, (_, i) => ({ id: `path-${i}` })) });
const sha = (await import('node:crypto')).createHash('sha256').update(content).digest('hex');
const stamp = '2026-11-21T02:41:46.000Z';
const object = 'spirit/library.json';
const url = `https://example.public.blob.vercel-storage.com/${object}`;
const makeRead = (etag) => ({
  statusCode: 200,
  blob: { etag, uploadedAt: new Date(stamp) },
  stream: new Response(content).body,
  headers: new Headers({ age: '2' }),
});
function fakeClient({ originTag = '"origin"', cdnTag = '"cdn"', originSize = Buffer.byteLength(content), upload = stamp, change = false } = {}) {
  let headCount = 0;
  return {
    async head() {
      headCount++;
      return { pathname: object, url, etag: change && headCount > 1 ? '"updated"' : originTag,
        size: originSize, uploadedAt: new Date(upload) };
    },
    async get(target, options) {
      if (options.ifNoneMatch) return { statusCode: 200, stream: new Response(content).body };
      assert.ok(target === object || target.startsWith(url + '?shiori_diagnostic='));
      return makeRead(cdnTag);
    },
    async list() { return { blobs: [{ pathname: object, size: originSize, uploadedAt: new Date(upload) }] }; },
  };
}
const opts = { pinnedSha: sha, pinnedSize: Buffer.byteLength(content), pinnedUpload: stamp };

test('ETag disagreement is reported without overriding either ETag', async () => {
  const r = await diagnose(fakeClient(), opts);
  assert.equal(r.comparisons.contentMatchesPinned, true);
  assert.equal(r.comparisons.headMatchesPinned, true);
  assert.equal(r.comparisons.getAndHeadEtagEqual, false);
  assert.match(r.recommendation, /^UNRESOLVED/);
});
test('matching CDN and origin ETags are described without claiming upload success', async () => {
  const r = await diagnose(fakeClient({ cdnTag: '"origin"' }), opts);
  assert.equal(r.comparisons.getAndHeadEtagEqual, true);
  assert.match(r.recommendation, /^ETAGS MATCH/);
});
test('same timestamp and byte count cannot mask changed HEAD ETag', async () => {
  const r = await diagnose(fakeClient({ change: true }), opts);
  assert.equal(r.controlPlane.headStable, false);
  assert.equal(r.comparisons.headMatchesPinned, false);
});
test('incorrect metadata timestamp forces stop', async () => {
  const r = await diagnose(fakeClient({ upload: '2026-11-21T03:00:00.000Z' }), opts);
  assert.equal(r.comparisons.headMatchesPinned, false);
});
test('rejects external Blob domains', async () => {
  const bad = fakeClient();
  bad.head = async () => ({ pathname: object, url: 'https://evil.example/secret', etag: '"origin"', size: 10, uploadedAt: stamp });
  await assert.rejects(() => diagnose(bad, opts), /Unexpected Blob URL/);
});
test('does not perform Blob mutations', async () => {
  const c = fakeClient();
  c.put = () => { throw new Error('NO PUT'); };
  c.copy = () => { throw new Error('NO COPY'); };
  c.del = () => { throw new Error('NO DEL'); };
  await diagnose(c, opts);
});
