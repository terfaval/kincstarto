/**
 * SHIORI-05 one-time, guarded cross-store migration.
 * No local copies, no plaintext logs. Order: private put+verify -> public conditional put.
 * Read-only by default; --apply needs interactive confirmation; --postcheck read-only.
 */
import { createHash } from 'node:crypto';
import { get, head, put } from '@vercel/blob';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { validateSpiritLibrary } from '../../src/lib/spiritSchema.ts';
import { assertDistinctShioriBlobTokens, resolveShioriPrivateBlobToken } from '../../src/lib/shioriPrivateStoreConfig.ts';
import {
  extractShioriPrivateState, publicShioriJson,
  publicShioriHasPersonalFields, validateShioriPrivateState,
} from '../../src/lib/shioriPrivateState.ts';

const PUBLIC = 'spirit/library.json';
const PRIVATE = 'spirit/reading-state.json';
const args = process.argv.slice(2);
const action = args.includes('--apply') ? 'apply' : args.includes('--postcheck') ? 'postcheck' : 'check';
if (args.some((arg) => !['--apply', '--postcheck', '--check'].includes(arg)) ||
    args.filter((arg) => arg.startsWith('--')).length !== 1 && args.length > 0) {
  throw new Error('Use exactly one of: --check, --apply, --postcheck');
}
const { publicToken, privateToken } = assertDistinctShioriBlobTokens(
  process.env.BLOB_READ_WRITE_TOKEN, resolveShioriPrivateBlobToken(),
);
const sha = (data) => createHash('sha256').update(data).digest('hex');
const etagBody = (s) => typeof s === 'string' ? s.replace(/^W\//, '') : null;
async function readPublic() {
  const item = await get(PUBLIC, { access: 'public', token: publicToken });
  if (!item?.stream || item.blob?.pathname !== PUBLIC || item.statusCode !== 200) throw new Error('Public catalog unavailable');
  const raw = await new Response(item.stream).text();
  const meta = await head(PUBLIC, { token: publicToken });
  if (meta.pathname !== PUBLIC || !/^"[^"\s]+"$/.test(meta.etag) ||
      etagBody(item.blob.etag) !== meta.etag || meta.size !== Buffer.byteLength(raw)) throw new Error('Public ETag/size mismatch; no write');
  return { raw, meta, library: validateSpiritLibrary(JSON.parse(raw)) };
}
async function readPrivateOptional() {
  const item = await get(PRIVATE, { access: 'private', token: privateToken, useCache: false });
  if (!item) return null;
  if (item.statusCode !== 200 || !item.stream || item.blob?.pathname !== PRIVATE) throw new Error('Private object unreadable');
  const raw = await new Response(item.stream).text();
  const meta = await head(PRIVATE, { token: privateToken });
  if (meta.pathname !== PRIVATE || etagBody(item.blob.etag) !== meta.etag || meta.size !== Buffer.byteLength(raw)) throw new Error('Private ETag mismatch');
  return { raw, state: validateShioriPrivateState(JSON.parse(raw)) };
}
function hasDroppedFields(original, parsed) {
  if (Array.isArray(original)) return !Array.isArray(parsed) || original.length !== parsed.length ||
    original.some((value, i) => hasDroppedFields(value, parsed[i]));
  if (original && typeof original === 'object') return !parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
    Object.entries(original).some(([key, value]) => !Object.hasOwn(parsed, key) || hasDroppedFields(value, parsed[key]));
  return original !== parsed;
}
function stats(state) {
  return {
    nonDefaultStatus: Object.values(state.books).filter((b) => b.status).length,
    bookNotes: Object.values(state.books).filter((b) => b.notes).length,
    pathProgress: Object.values(state.paths).filter((p) => p.progress !== undefined).length,
    pathComments: Object.values(state.paths).reduce((sum, path) => sum + Object.keys(path.comments ?? {}).length, 0),
  };
}
async function check() {
  const pub = await readPublic();
  if (pub.library.books.length < 86 || (pub.library.paths?.length ?? 0) < 8) {
    throw new Error('Live catalog unexpectedly smaller than the verified 86 books / 8 paths; STOP');
  }
  const existing = await readPrivateOptional();
  const rawObject = JSON.parse(pub.raw);
  console.log(JSON.stringify({ action: action.toUpperCase(), public: {
    books: pub.library.books.length, paths: pub.library.paths?.length ?? 0,
    sha256: sha(pub.raw), personalFieldsPresent: publicShioriHasPersonalFields(rawObject),
  }, privateObjectExists: Boolean(existing),
  ...(existing ? { privateCounts: stats(existing.state) } : {}),
  }, null, 2));
  return { pub, existing, containsPrivate: publicShioriHasPersonalFields(rawObject) };
}
try {
  // SHIORI-05C/1: legacy apply cannot know who owns historical statuses/notes.
  // The full handoff requires ownership review and editorial/private notes classification.
  // Disable ALL production writes until an explicitly reviewed 05C/2 migration replaces it.
  if (action === 'apply') {
    throw new Error('SHIORI_05C_APPLY_LOCKED: owner and notes classification not yet approved; no writes');
  }
  const { pub, existing, containsPrivate } = await check();
  if (action === 'postcheck') {
    if (containsPrivate || !existing) throw new Error('Migration not verified: public leaks or private object missing');
    console.log('POSTCHECK VERIFIED: public catalog has no reading-state fields and private state is accessible. READ ONLY.');
  } else if (action === 'check') {
    console.log('READ ONLY. Migration has NOT been executed by this command.');
  } else {
    if (!containsPrivate) throw new Error('Public catalog is already sanitized. Never repeat apply; use --postcheck');
    if (hasDroppedFields(JSON.parse(pub.raw), pub.library)) {
      throw new Error('Unknown or transformed public schema fields: no migration; upgrade schema first');
    }
    const state = validateShioriPrivateState(extractShioriPrivateState(pub.library));
    const serialized = `${JSON.stringify(state, null, 2)}\n`;
    if (existing && sha(existing.raw) !== sha(serialized)) {
      throw new Error('Existing private state differs from current legacy values. No write; manual reconciliation required');
    }
    const sanitized = publicShioriJson(pub.library);
    if (publicShioriHasPersonalFields(JSON.parse(sanitized))) throw new Error('Sanitizer failed; no write');
    const parsedSanitized = validateSpiritLibrary(JSON.parse(sanitized));
    if (parsedSanitized.books.length !== pub.library.books.length ||
      (parsedSanitized.paths?.length ?? 0) !== (pub.library.paths?.length ?? 0)) throw new Error('Public record count changed');
    console.log('ONE-TIME PRODUCTION MIGRATION: private-state write THEN public catalog redaction. No automatic retry.');
    console.log(`Public books=${pub.library.books.length} paths=${pub.library.paths?.length ?? 0}; private counts=${JSON.stringify(stats(state))}`);
    const prompt = createInterface({ input: stdin, output: stdout });
    const confirmation = await prompt.question('Type exactly SHIORI PRIVATE ALLAPOT ATVITEL: ');
    prompt.close();
    if (confirmation !== 'SHIORI PRIVATE ALLAPOT ATVITEL') throw new Error('Not authorized');
    if (!existing) {
      await put(PRIVATE, serialized, { token: privateToken, access: 'private', contentType: 'application/json', cacheControlMaxAge: 60 });
      const verified = await readPrivateOptional();
      if (!verified || sha(verified.raw) !== sha(serialized)) throw new Error('Private write uncertain. STOP; inspect before retry');
      console.log('PRIVATE STATE VERIFIED. Public content has NOT yet been changed.');
    }
    const immediate = await readPublic();
    if (immediate.meta.etag !== pub.meta.etag || sha(immediate.raw) !== sha(pub.raw)) {
      throw new Error('Public source changed after private-state write. STOP; no public write');
    }
    let uploaded;
    try {
      uploaded = await put(PUBLIC, sanitized, {
        token: publicToken, access: 'public', contentType: 'application/json',
        cacheControlMaxAge: 60, allowOverwrite: true, ifMatch: pub.meta.etag,
      });
    } catch {
      throw new Error('Public conditional write failed or result unknown. STOP; never auto retry');
    }
    const after = await head(PUBLIC, { token: publicToken });
    if (uploaded.pathname !== PUBLIC || uploaded.etag !== after.etag || after.size !== Buffer.byteLength(sanitized)) {
      throw new Error('Public write may have succeeded but metadata verification failed. STOP; run --postcheck');
    }
    console.log(`ONE CONDITIONAL REDACTION WRITE ACCEPTED; public target SHA256=${sha(sanitized)}.`);
    console.log('Do not re-run --apply. Run --postcheck separately, and only then enable SHIORI_PRIVATE_STATE_READY=1.');
  }
} catch (error) {
  console.error(`SHIORI-05 STOPPED: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
}
