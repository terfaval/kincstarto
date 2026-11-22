import test from 'node:test';
import assert from 'node:assert/strict';
import { readFreshPublicShioriBlob } from '../../src/lib/spiritBlobFreshPublicRead.ts';

const body = '{"library_version":"v2","books":[]}\n';
const etag = '"rev002"';
const meta = { pathname: 'spirit/library.json', url: 'https://abc123.public.blob.vercel-storage.com/spirit/library.json', etag, size: Buffer.byteLength(body) };

function mockFetch({ responseEtag = etag, content = body, status = 200 } = {}) {
  return async (url, init) => {
    assert.equal(url.hostname, 'abc123.public.blob.vercel-storage.com');
    assert.equal(url.searchParams.get('v'), 'rev002');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
    return new Response(content, { status, headers: {etag: responseEtag} });
  };
}

test('version-keyed public fetch returns verified content', async () => {
  assert.equal(await readFreshPublicShioriBlob(meta, 'spirit/library.json', mockFetch()), body);
});
test('rejects stale CDN ETag', async () => {
  await assert.rejects(readFreshPublicShioriBlob(meta, 'spirit/library.json', mockFetch({ responseEtag: '"rev001"' })), /revision mismatch/);
});
test('rejects content size mismatch', async () => {
  await assert.rejects(readFreshPublicShioriBlob(meta, 'spirit/library.json', mockFetch({ content: body + 'extra' })), /byte count mismatch/);
});
test('rejects non-public Blob hosts', async () => {
  await assert.rejects(readFreshPublicShioriBlob({ ...meta, url: 'https://attacker.example/spirit/library.json' }, 'spirit/library.json', mockFetch()), /Unexpected public Blob URL/);
});
test('rejects different pathname and malformed ETag', async () => {
  await assert.rejects(readFreshPublicShioriBlob({ ...meta, pathname: 'other/path.json' }, 'spirit/library.json', mockFetch()), /Invalid public Blob metadata/);
  await assert.rejects(readFreshPublicShioriBlob({ ...meta, etag: 'rev002' }, 'spirit/library.json', mockFetch()), /Invalid public Blob metadata/);
});
