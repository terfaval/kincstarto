import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertDistinctShioriBlobTokens, resolveShioriPrivateBlobToken } from '../../src/lib/shioriPrivateStoreConfig.ts';
import { preflight } from './shiori-private-store-preflight.mjs';

const publicToken = 'vercel_blob_rw_publicStore1_secret-one';
const privateToken = 'vercel_blob_rw_privateStore2_secret-two';
const fixture = JSON.parse(await readFile(new URL('../../data/spirit/library.json', import.meta.url), 'utf8'));
const books = Array.from({length:86}, (_, i) => i < fixture.books.length ? fixture.books[i] : {
  ...fixture.books[0], id:`test_book_${i}`, title:`Test book ${i}`,
  related: [], status:'unread', notes:'',
});
const paths = Array.from({length:8}, (_, i) => i < fixture.paths.length ? fixture.paths[i] : {
  ...fixture.paths[0], id:`test_path_${i}`,
  items:[], progress:0,
});
const source = JSON.stringify({...fixture, books, paths});
const data = new TextEncoder().encode(source);
const response = (value, pathname, etag='W/"v1"') => ({statusCode:200, stream:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(value));c.close();}}), blob:{pathname,etag}});
const api = {
  get: async (path) => path === 'spirit/library.json' ? response(source,path) : null,
  head: async (path) => ({pathname:path, size:data.byteLength, etag:'"v1"'}),
  list: async () => ({blobs:[],hasMore:false}),
  validateLibrary: obj => obj,
  validateState: obj => obj,
  hasPersonal: obj => obj.books.some(book => Object.hasOwn(book,'status')),
};

test('two tokens from different stores are accepted', () => {
  assert.equal(assertDistinctShioriBlobTokens(publicToken,privateToken).privateToken,privateToken);
});
test('different secrets from same store are rejected', () => {
  assert.throws(() => assertDistinctShioriBlobTokens(publicToken,'vercel_blob_rw_publicStore1_other-secret'), /ugyanarra/);
});
test('missing and malformed tokens fail closed', () => {
  assert.throws(() => assertDistinctShioriBlobTokens(publicToken,''));
  assert.throws(() => assertDistinctShioriBlobTokens(publicToken,'opaque-private-secret'));
});
test('read-only preflight verifies split-store catalog without writes', async () => {
  const report=await preflight({publicToken,privateToken},api);
  assert.equal(report.mode,'READ_ONLY');
  assert.equal(report.catalogBooks,86);
  assert.equal(report.catalogPaths,8);
  assert.equal(report.privateObjectExists,false);
  assert.equal(report.privateAccessVerifiedFromExistingObject,false);
  assert.equal(report.action,'NO_WRITES');
});
test('unexpected public store URLs under private token force stop',async () => {
  await assert.rejects(() => preflight({publicToken,privateToken},{...api,list:async()=>({blobs:[{url:'https://abc.public.blob.vercel-storage.com/a.json'}]})}), /non-private/);
});
test('stale or unexpected public catalog blocks preflight',async () => {
  await assert.rejects(()=>preflight({publicToken,privateToken},{...api,head:async(p)=>({pathname:p,size:1,etag:'"v1"'})}), /mismatch/);
});
test('preflight and migration have no automatic destructive action',async()=>{
  const src=await readFile(new URL('./shiori-private-store-preflight.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(src,/\bput\s*\(|\bdel\s*\(/);
  assert.match(src,/NO_WRITES/);
  const migration=await readFile(new URL('./shiori-private-state-migrate.mjs',import.meta.url),'utf8');
  assert.match(migration,/assertDistinctShioriBlobTokens/);
  assert.match(migration,/SHIORI PRIVATE ALLAPOT ATVITEL/);
});

test('Vercel-provisioned private token is accepted without a duplicate alias', () => {
  assert.equal(resolveShioriPrivateBlobToken({SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN:privateToken}),privateToken);
});
test('matching legacy alias stays compatible', () => {
  assert.equal(resolveShioriPrivateBlobToken({SHIORI_PRIVATE_BLOB_TOKEN:privateToken, SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN:privateToken}),privateToken);
});
test('conflicting private aliases fail closed before any Blob access', () => {
  assert.throws(() => resolveShioriPrivateBlobToken({SHIORI_PRIVATE_BLOB_TOKEN:privateToken, SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_privateStore3_other'}), /eltero/);
});
