/**
 * SHIORI-05B dual-store preflight. READ ONLY: get/head/list only.
 * No raw book data, private state or credentials are logged.
 * An empty store's private access mode MUST also be checked in Vercel dashboard.
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertDistinctShioriBlobTokens, resolveShioriPrivateBlobToken } from '../../src/lib/shioriPrivateStoreConfig.ts';

const PUBLIC = 'spirit/library.json';
const PRIVATE = 'spirit/reading-state.json';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const comparableEtag = (tag) => typeof tag === 'string' && /^(W\/)?"[^"\s]+"$/.test(tag)
  ? tag.replace(/^W\//, '') : null;

export async function preflight({ publicToken, privateToken }, transport) {
  // Verify credentials before any network requests (and before any possible future write).
  assertDistinctShioriBlobTokens(publicToken, privateToken);
  const publicItem = await transport.get(PUBLIC, { access: 'public', token: publicToken });
  if (!publicItem || publicItem.statusCode !== 200 || !publicItem.stream || publicItem.blob?.pathname !== PUBLIC) {
    throw new Error('Public Blob cannot be read');
  }
  const raw = await new Response(publicItem.stream).text();
  const metadata = await transport.head(PUBLIC, { token: publicToken });
  if (metadata?.pathname !== PUBLIC || metadata.size !== Buffer.byteLength(raw) ||
      !comparableEtag(metadata.etag) || comparableEtag(publicItem.blob.etag) !== metadata.etag) {
    throw new Error('Public Blob ETag or size mismatch; STOP');
  }
  const library = transport.validateLibrary(JSON.parse(raw));
  if (library.books.length < 86 || (library.paths?.length ?? 0) < 8) {
    throw new Error('Public catalog smaller than the restored 86/8 baseline; STOP');
  }

  // list() proves the token is usable; existing URLs can also prove the store's access mode.
  const listing = await transport.list({ token: privateToken, limit: 1000 });
  if (!listing || !Array.isArray(listing.blobs)) throw new Error('Private Blob list failed');
  if (listing.blobs.some((blob) => typeof blob.url !== 'string' ||
      !/^https:\/\/[a-zA-Z0-9-]+\.private\.blob\.vercel-storage\.com\//.test(blob.url))) {
    throw new Error('A private store list includes non-private URLs; STOP');
  }
  const stateItem = await transport.get(PRIVATE, { access: 'private', token: privateToken, useCache: false });
  let privateObjectExists = false;
  if (stateItem !== null) {
    if (!stateItem || stateItem.statusCode !== 200 || !stateItem.stream || stateItem.blob?.pathname !== PRIVATE) {
      throw new Error('Private state not readable; STOP');
    }
    const privateRaw = await new Response(stateItem.stream).text();
    transport.validateState(JSON.parse(privateRaw));
    const privateMeta = await transport.head(PRIVATE, { token: privateToken });
    if (privateMeta?.pathname !== PRIVATE || privateMeta.size !== Buffer.byteLength(privateRaw) ||
        !comparableEtag(privateMeta.etag) || comparableEtag(stateItem.blob.etag) !== privateMeta.etag ||
        !/^https:\/\/[a-zA-Z0-9-]+\.private\.blob\.vercel-storage\.com\//.test(privateMeta.url)) {
      throw new Error('Private state metadata/access mismatch; STOP');
    }
    privateObjectExists = true;
  }
  return {
    mode: 'READ_ONLY', separatedStoreTokens: true, catalogBooks: library.books.length,
    catalogPaths: library.paths?.length ?? 0, publicSha256: sha(raw),
    publicPersonalFieldsPresent: transport.hasPersonal(JSON.parse(raw)),
    privateObjectExists, privateStoreObjectCountSample: listing.blobs.length,
    privateAccessVerifiedFromExistingObject: listing.blobs.length > 0 || privateObjectExists,
    action: 'NO_WRITES',
  };
}

// Do not run the network probe when this module is imported by unit tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Only --check is supported');
    const [{ get, head, list }, { validateSpiritLibrary }, { validateShioriPrivateState, publicShioriHasPersonalFields }] = await Promise.all([
      import('@vercel/blob'), import('../../src/lib/spiritSchema.ts'),
      import('../../src/lib/shioriPrivateState.ts'),
    ]);
    const report = await preflight({
      publicToken: process.env.BLOB_READ_WRITE_TOKEN,
      privateToken: resolveShioriPrivateBlobToken(),
    }, {get,head,list,validateLibrary:validateSpiritLibrary,validateState:validateShioriPrivateState,hasPersonal:publicShioriHasPersonalFields});
    console.log(JSON.stringify(report, null, 2));
    console.log('READ ONLY. No migration and no Blob mutations performed.');
  } catch {
    console.error('SHIORI-05B PREFLIGHT STOPPED: check the two store credentials, access mode and version. No data was changed.');
    process.exitCode = 1;
  }
}
