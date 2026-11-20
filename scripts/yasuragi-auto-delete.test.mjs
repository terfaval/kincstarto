import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupSupersededImage } from '../src/lib/yogiOldImageCleanupCore.ts';

const host = 'https://yasuragi.public.blob.vercel-storage.com/';
const oldUrl = host + 'yogi/images/tree/mannequin_angled-1775000000000.png';
const newUrl = host + 'yogi/images/tree/illustration-abcdef01-1775000000001.webp';
const backupHash = 'e'.repeat(64);

function fakeBlob({ referenced = false, staleGet = false, changedAfterRead = false, missingPoses = false, deleteFailure = false } = {}) {
  const poses = JSON.stringify([{ id: 'pose_tree', mannequin_angled: {asset_ref: newUrl} }]);
  const anatomy = JSON.stringify([{ id: 'metadata', notes: referenced ? oldUrl : 'no reference' }]);
  const docs = new Map([
    ['yogi/poses.json', poses],
    ['yogi/anatomy.json', anatomy],
  ]);
  if (missingPoses) docs.delete('yogi/poses.json');
  const deletions = [];
  const calls = [];
  const metadata = (pathname) => ({ pathname, url: host + pathname, size: Buffer.byteLength(docs.get(pathname) ?? ''), etag: pathname === 'yogi/poses.json' ? 'p123' : 'a456' });
  return {
    deletions,
    calls,
    client: {
      async list(options) {
        calls.push(['list', options]);
        return {
          blobs: [...docs.keys()].map(metadata),
          hasMore: false,
        };
      },
      async head(path) {
        calls.push(['head', path]);
        if (path === oldUrl) return { pathname: new URL(oldUrl).pathname.slice(1), url: oldUrl, etag: 'original-version' };
        if (!docs.has(path)) return null;
        const result = metadata(path);
        if (changedAfterRead && calls.filter((c) => c[0] === 'head' && c[1] === path).length > 1) result.etag = 'changed-version';
        return result;
      },
      async get(path, options) {
        calls.push(['get', path, options]);
        assert.deepEqual(options, { access: 'public' });
        if (!docs.has(path)) return null;
        const raw = docs.get(path);
        return {
          statusCode: 200,
          stream: new Response(raw).body,
          blob: { etag: staleGet ? 'older-version' : `W/"${metadata(path).etag}"` },
        };
      },
      async del(url, opts) {
        calls.push(['del', url, opts]);
        if (deleteFailure) throw new Error('provider failed');
        assert.equal(url, oldUrl);
        assert.deepEqual(opts, { ifMatch: 'original-version' });
        deletions.push(url);
      },
    },
  };
}

const request = (client, extras = {}) => ({
  enabled: true,
  backupManifestSha256: backupHash,
  previousUrl: oldUrl,
  currentUrl: newUrl,
  blob: client,
  ...extras,
});

test('disabled unless BOTH switch and verified-backup marker are configured; no network calls', async () => {
  const {client, calls} = fakeBlob();
  assert.equal((await cleanupSupersededImage(request(client, {enabled:false}))).status, 'disabled');
  assert.equal((await cleanupSupersededImage(request(client, {backupManifestSha256:''}))).status, 'disabled');
  assert.equal(calls.length, 0);
});

test('deletes the former pose image after fresh JSON ETag checks, using conditional ifMatch', async () => {
  const {client, deletions, calls} = fakeBlob();
  const result = await cleanupSupersededImage(request(client));
  assert.deepEqual(result, {status:'deleted', pathname:'yogi/images/tree/mannequin_angled-1775000000000.png'});
  assert.deepEqual(deletions, [oldUrl]);
  assert.equal(calls.filter((c) => c[0] === 'get').length, 2);
  assert.equal(calls.filter((c) => c[0] === 'head' && c[1] === 'yogi/poses.json').length, 2);
});

test('does not delete an image still referenced from any auxiliary Yasuragi JSON document', async () => {
  const {client, deletions} = fakeBlob({referenced:true});
  const result = await cleanupSupersededImage(request(client));
  assert.equal(result.status, 'skipped');
  assert.deepEqual(deletions, []);
});

test('stale public JSON response or concurrently modified JSON fails closed', async () => {
  for (const opts of [{staleGet:true}, {changedAfterRead:true}]) {
    const {client, deletions} = fakeBlob(opts);
    assert.equal((await cleanupSupersededImage(request(client))).status, 'failed');
    assert.equal(deletions.length, 0);
  }
});

test('missing canonical pose store refuses deletion', async () => {
  const {client, deletions} = fakeBlob({missingPoses:true});
  assert.equal((await cleanupSupersededImage(request(client))).status, 'failed');
  assert.deepEqual(deletions, []);
});

test('foreign, non-pose and cross-store URLs are never deleted', async () => {
  const {client, calls} = fakeBlob();
  for (const previousUrl of [
    'https://example.com/elsewhere.png',
    host + 'yogi/images/tree/scientific_image-1775000000000.png',
    host + 'yogi/poses.json',
    host + 'yogi/images/tree/mannequin_angled-1775000000000.png?x=1',
    'https://evil.public.blob.vercel-storage.com/yogi/images/tree/mannequin_angled-1775000000000.png',
  ]) {
    assert.equal((await cleanupSupersededImage(request(client, {previousUrl}))).status, 'skipped');
  }
  assert.equal(calls.length, 0);
});

test('provider delete error never invalidates a successfully committed new illustration', async () => {
  const {client} = fakeBlob({deleteFailure:true});
  assert.equal((await cleanupSupersededImage(request(client))).status, 'failed');
});
