import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShioriRecoveryCandidate } from './shiori-recovery-core.mjs';
import { verifyRecoveryBundle, shaObject, shaRaw, blobReadOptions, verifyBlobSnapshot, comparableETag, readVersionCheckedBlob, conditionalWriteOptions, conditionalWrite, verifyWriteMetadata } from './shiori-recovery-promotion-core.mjs';

const book = (n, status = 'olvasatlan') => ({ id: `b${n}`, title: `Book ${n}`, author: 'Author', themes: ['t'], status, related: [] });
const base = {
  library_version: 'v2',
  thematic_pills: [{ slug: 't', label: 'T' }],
  books: Array.from({length: 59}, (_, n) => book(n, n === 0 ? 'folyamatban' : 'olvasatlan')),
  paths: Array.from({length: 4}, (_, n) => ({ id: `p${n}`, title: `Original ${n}`, book_ids: [`b${n}`], progress: n })),
  tag_labels: { t: 'Original label' },
};
base.books[0].notes = 'private note';
const ref = {
  library_version: 'v2', thematic_pills: [{ slug: 't', label: 'T' }],
  books: [...Array.from({length:59},(_,n)=>book(n, 'befejezett')), ...Array.from({length:27},(_,n)=>book(n+59))],
  paths: [ ...Array.from({length:4}, (_,n)=> ({id:`p${n}`,title:'Changed',book_ids:[`b${n}`, 'b59']})),
    ...Array.from({length:4},(_,n)=>({id:`p${n+4}`, title: `New ${n}`,book_ids:['b59']})) ],
  tag_labels: { t: 'Reference label', extra: 'Extra label' },
};
ref.books[0].related = ['b59'];
const { candidate, report } = makeShioriRecoveryCandidate(base, ref);
const backupRaw = JSON.stringify(base);
const candidateRaw = JSON.stringify(candidate);
const manifest = {
  operation: 'LOCAL_BACKUP_AND_MERGE_PREVIEW_ONLY_NO_BLOB_WRITES',
  liveFingerprint: shaObject(base), resultFingerprint: shaObject(candidate), liveRawSha256: shaRaw(backupRaw), report,
};
const opts = { backupRaw, candidateRaw, manifest, liveRaw: backupRaw, expectedLiveSha: shaObject(base), expectedCandidateSha: shaObject(candidate) };

test('matching bundle verifies 59 -> 86 while preserving existing personal fields and paths', () => {
  const result = verifyRecoveryBundle(opts);
  assert.equal(result.books, 86);
  assert.equal(result.paths, 8);
  assert.equal(candidate.books[0].notes, 'private note');
  assert.equal(candidate.books[0].status, 'folyamatban');
  assert.deepEqual(candidate.paths[0], base.paths[0]);
});

test('changed live catalog fails before possible overwrite', () => {
  const liveRaw = JSON.stringify({ ...base, books: [...base.books,book(99)] });
  assert.throws(() => verifyRecoveryBundle({ ...opts, liveRaw }), /LIVE BLOB HAS CHANGED/);
});

test('tampered candidate fails checksum even if otherwise valid', () => {
  const altered = structuredClone(candidate);
  altered.books[1].title = 'Changed';
  assert.throws(() => verifyRecoveryBundle({ ...opts, candidateRaw: JSON.stringify(altered) }), /Local candidate was changed/);
});

test('damaged local raw backup fails validation', () => {
  assert.throws(() => verifyRecoveryBundle({ ...opts, backupRaw: backupRaw + '\n' }), /Raw local backup hash mismatch/);
});

test('manifest with wrong addition IDs fails', () => {
  const altered = structuredClone(manifest);
  altered.report.addedBookIds[0] = 'b0';
  assert.throws(() => verifyRecoveryBundle({ ...opts, manifest: altered }), /Manifest added book mismatch/);
});

// Regression for HTTP 400: a public get must not pass private-only cache-bypass options.
test('public Blob uses supported read options', () => {
  assert.deepEqual(blobReadOptions('public'), { access: 'public' });
});

test('private Blob uses origin read options', () => {
  assert.deepEqual(blobReadOptions('private'), { access: 'private', useCache: false });
});

test('unexpected Blob access mode fails closed', () => {
  assert.throws(() => blobReadOptions('unknown'), /Unsupported Blob access mode/);
});

test('weak CDN ETag and strong HEAD ETag compare as the same opaque tag', () => {
  assert.equal(comparableETag('W/"old123"'), '"old123"');
  assert.equal(comparableETag('"old123"'), '"old123"');
  assert.equal(verifyBlobSnapshot({
    raw: backupRaw,
    blob: { pathname: 'spirit/library.json', etag: 'W/"old123"' },
    head: { pathname: 'spirit/library.json', etag: '"old123"', size: Buffer.byteLength(backupRaw) },
  }), '"old123"');
});

test('weak CDN ETag cannot conceal a different origin version or malformed tag', () => {
  const source = { pathname: 'spirit/library.json', etag: 'W/"old123"' };
  const origin = { pathname: 'spirit/library.json', etag: '"new456"', size: Buffer.byteLength(backupRaw) };
  assert.throws(() => verifyBlobSnapshot({ raw: backupRaw, blob: source, head: origin }), /ETags differ/);
  for (const bad of ['W/old123', 'w/"old123"', 'W/W/"old123"', 'W/"old123"\n', '']) {
    assert.equal(comparableETag(bad), null);
  }
  assert.throws(() => verifyBlobSnapshot({
    raw: backupRaw, blob: source, head: { ...origin, etag: 'W/"old123"' },
  }), /strong ETag/);
});

const fakeGetMeta = { pathname: 'spirit/library.json', etag: '"old123"' };
const fakeHeadMeta = { pathname: 'spirit/library.json', etag: '"old123"', size: Buffer.byteLength(backupRaw) };

test('CDN bytes and control-plane metadata must represent exactly the same version', () => {
  assert.equal(verifyBlobSnapshot({ raw: backupRaw, blob: fakeGetMeta, head: fakeHeadMeta }), '"old123"');
  assert.throws(() => verifyBlobSnapshot({ raw: backupRaw, blob: fakeGetMeta, head: { ...fakeHeadMeta, etag: '"new456"' } }), /ETags differ/);
  assert.throws(() => verifyBlobSnapshot({ raw: backupRaw, blob: fakeGetMeta, head: { ...fakeHeadMeta, size: 3 } }), /size differs/);
  assert.throws(() => verifyBlobSnapshot({ raw: backupRaw, blob: {}, head: fakeHeadMeta }), /pathname mismatch/);
});

test('conditional overwrite requires nonempty quoted ETag', () => {
  const opts = conditionalWriteOptions('public', '"old123"');
  assert.deepEqual(opts, { access: 'public', contentType: 'application/json', allowOverwrite: true, ifMatch: '"old123"' });
  for (const bad of ['', undefined, 'not-quoted', '"\n"']) {
    assert.throws(() => conditionalWriteOptions('public', bad), /quoted ETag/);
  }
});

test('single write is made with ifMatch and exact reviewed bytes', async () => {
  const calls = [];
  const transport = {
    async put(path, raw, options) { calls.push({path,raw,options}); return { pathname: path, etag: '"new456"' }; },
  };
  const result = await conditionalWrite(transport, { pathname: 'spirit/library.json', raw: candidateRaw, access: 'public', etag: '"old123"' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, 'spirit/library.json');
  assert.equal(calls[0].raw, candidateRaw);
  assert.equal(calls[0].options.ifMatch, '"old123"');
  assert.equal(result.etag, '"new456"');
});

test('concurrent change is rejected by conditional storage transport', async () => {
  let originTag = '"changed-in-another-admin-session"';
  let callCount = 0;
  const transport = {
    async put(_path, _raw, opts) {
      callCount++;
      if (opts.ifMatch !== originTag) {
        const conflict = new Error('412');
        conflict.name = 'BlobPreconditionFailedError';
        throw conflict;
      }
      originTag = '"written"';
    },
  };
  await assert.rejects(conditionalWrite(transport, { pathname: 'spirit/library.json', raw: candidateRaw, access: 'public', etag: '"old123"' }), /412/);
  assert.equal(callCount, 1);
  assert.equal(originTag, '"changed-in-another-admin-session"');
});

test('write response needs matching origin metadata; CDN cannot prove post-write success', () => {
  assert.equal(verifyWriteMetadata({ beforeEtag: '"old123"', response: { pathname: 'spirit/library.json', etag: '"new456"' }, after: { pathname: 'spirit/library.json', etag: '"new456"', size: Buffer.byteLength(candidateRaw) }, candidateRaw }), '"new456"');
  assert.throws(() => verifyWriteMetadata({ beforeEtag: '"old123"', response: { pathname: 'spirit/library.json', etag: '"new456"' }, after: { pathname: 'spirit/library.json', etag: '"old123"', size: Buffer.byteLength(candidateRaw) }, candidateRaw }), /does not match/);
});

const metaFor = (etag, raw) => ({
  pathname: 'spirit/library.json',
  etag,
  size: Buffer.byteLength(raw, 'utf8'),
  url: 'https://test123.public.blob.vercel-storage.com/spirit/library.json',
});
const getResult = (etag, raw) => ({
  statusCode: 200,
  stream: new Blob([raw]).stream(),
  blob: { pathname: 'spirit/library.json', etag },
});

test('normal public read returns verified version without extra requests', async () => {
  let getCount = 0; let headCount = 0;
  const blobClient = {
    async get(path, options) {
      getCount++;
      assert.equal(path, 'spirit/library.json');
      assert.deepEqual(options, { access: 'public' });
      return getResult('"v1"', backupRaw);
    },
    async head(path) { headCount++; assert.equal(path, 'spirit/library.json'); return metaFor('"v1"', backupRaw); },
  };
  const snap = await readVersionCheckedBlob(blobClient, 'spirit/library.json', 'public');
  assert.equal(snap.cacheBusted, false);
  assert.equal(snap.raw, backupRaw);
  assert.equal(snap.etag, '"v1"');
  assert.equal(getCount, 1);
  assert.equal(headCount, 1);
});

test('weak CDN GET ETag is read-only equivalent to strong HEAD without a retry', async () => {
  let getCount = 0; let headCount = 0;
  const client = {
    async get() { getCount++; return getResult('W/"same-version"', backupRaw); },
    async head() { headCount++; return metaFor('"same-version"', backupRaw); },
  };
  const snapshot = await readVersionCheckedBlob(client, 'spirit/library.json', 'public');
  assert.equal(snapshot.raw, backupRaw);
  assert.equal(snapshot.etag, '"same-version"'); // Only strong HEAD is authorized for ifMatch.
  assert.deepEqual(conditionalWriteOptions('public', snapshot.etag), {
    access: 'public', contentType: 'application/json', allowOverwrite: true, ifMatch: '"same-version"',
  });
  assert.equal(getCount, 1);
  assert.equal(headCount, 1);
});

test('stale public CDN GET retries a unique URL and verifies both HEAD versions', async () => {
  let getCount = 0; let headCount = 0;
  const blobClient = {
    async get(path, options) {
      getCount++;
      assert.deepEqual(options, { access: 'public' });
      if (getCount === 1) {
        assert.equal(path, 'spirit/library.json');
        return getResult('"stale"', backupRaw);
      }
      const url = new URL(path);
      assert.equal(url.searchParams.get('shiori_verify'), 'unit-test-1234');
      return getResult('"current"', backupRaw);
    },
    async head() { headCount++; return metaFor('"current"', backupRaw); },
  };
  const snap = await readVersionCheckedBlob(blobClient, 'spirit/library.json', 'public', () => 'unit-test-1234');
  assert.equal(snap.cacheBusted, true);
  assert.equal(snap.etag, '"current"');
  assert.equal(getCount, 2);
  assert.equal(headCount, 2);
});

test('persistent public CDN mismatch still fails closed', async () => {
  let headCount = 0; let getCount = 0;
  const blobClient = {
    async get() { getCount++; return getResult('"stale"', backupRaw); },
    async head() { headCount++; return metaFor('"current"', backupRaw); },
  };
  await assert.rejects(readVersionCheckedBlob(blobClient, 'spirit/library.json', 'public', () => 'unit-test-1234'), /recheck still disagrees/);
  assert.equal(getCount, 2);
  assert.equal(headCount, 2);
});

test('origin HEAD changing between CDN reads fails closed', async () => {
  let headCount = 0;
  const blobClient = {
    async get(path) { return getResult(path.includes('?') ? '"newer"' : '"stale"', backupRaw); },
    async head() { headCount++; return metaFor(headCount === 1 ? '"current"' : '"newer"', backupRaw); },
  };
  await assert.rejects(readVersionCheckedBlob(blobClient, 'spirit/library.json', 'public', () => 'unit-test-1234'), /version changed during CDN recheck/);
});

test('private mismatch never attempts public CDN bypass', async () => {
  let getCount = 0;
  const blobClient = {
    async get() { getCount++; return getResult('"cached"', backupRaw); },
    async head() { return metaFor('"origin"', backupRaw); },
  };
  await assert.rejects(readVersionCheckedBlob(blobClient, 'spirit/library.json', 'private', () => 'unit-test-1234'), /ETags differ/);
  assert.equal(getCount, 1);
});

test('invalid control-plane public URL refuses CDN recheck', async () => {
  const blobClient = {
    async get() { return getResult('"stale"', backupRaw); },
    async head() { return {...metaFor('"origin"', backupRaw), url: 'https://example.com/spirit/library.json'}; },
  };
  await assert.rejects(readVersionCheckedBlob(blobClient, 'spirit/library.json', 'public', () => 'unit-test-1234'), /Unexpected public blob URL/);
});
