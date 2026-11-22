/**
 * P05c opt-in Vercel Blob smoke check. NO LIVE YOGI PATHS, NO DELETES.
 * Intentionally creates isolated diagnostics/ blobs only, in a DISPOSABLE store.
 * Do not supply a token from a live Kincstarto store.
 * Requires installed @vercel/blob; does not load .env.local automatically.
 */
import { randomUUID } from 'node:crypto';
import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob';

const token = process.env.YASURAGI_P05C_DISPOSABLE_BLOB_TOKEN;
const confirm = process.env.YASURAGI_P05C_CONFIRM;
const access = process.env.YASURAGI_P05C_DISPOSABLE_ACCESS ?? 'private';
if (!token || confirm !== 'YES_DISPOSABLE_STORE' || !['private', 'public'].includes(access) ||
    token === process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('STOP: set a separate disposable Blob token, YASURAGI_P05C_CONFIRM=YES_DISPOSABLE_STORE, and valid DISPOSABLE_ACCESS. Never use the live store token.');
  process.exit(2);
}

const prefix = `diagnostics/yasuragi-p05c/${randomUUID()}/`;
const pointerPath = `${prefix}head.json`;
const opts = { access, token, contentType: 'application/json', cacheControlMaxAge: 60 };
const payload = (name) => JSON.stringify({ format: 'yasuragi.p05c.smoke.v1', name, scope: prefix });
const putNew = (path, text) => put(path, text, { ...opts, allowOverwrite: false });
const meta = (path) => head(path, { token });
const read = (path) => get(path, { access, token });
const status = [];

try {
  let missing = false;
  try {
    await meta(pointerPath);
  } catch (cause) {
    if (cause instanceof BlobNotFoundError) missing = true;
    else throw cause;
  }
  if (!missing) throw new Error('Unexpected diagnostic head at fresh path');
  status.push('Missing-head handling: OK');

  const base = await putNew(`${prefix}base.json`, payload('base'));
  const baseRead = await read(base.pathname);
  if (!baseRead?.stream || (await new Response(baseRead.stream).text()) !== payload('base')) {
    throw new Error('Immutable diagnostic revision did not read back');
  }
  status.push('Immutable revision verification: OK');

  await putNew(pointerPath, JSON.stringify({ ref: base.pathname }));
  const initial = await meta(pointerPath);
  const readBefore = await read(pointerPath);
  const cachedBefore = readBefore?.blob?.etag !== initial.etag;
  if (cachedBefore) status.push('Pointer cache: initial GET stale (fail-closed required)');
  else status.push('Pointer cache: initial GET agrees with HEAD');

  const [a, b] = await Promise.all([
    putNew(`${prefix}alpha.json`, payload('alpha')),
    putNew(`${prefix}beta.json`, payload('beta')),
  ]);
  const compareAndSwap = async (ref) => {
    try {
      await put(pointerPath, JSON.stringify({ ref }), {
        ...opts, allowOverwrite: true, ifMatch: initial.etag,
      });
      return { outcome: 'committed' };
    } catch (cause) {
      if (cause instanceof BlobPreconditionFailedError ||
          cause?.statusCode === 409 || cause?.statusCode === 412) return { outcome: 'conflict' };
      throw cause;
    }
  };
  const results = await Promise.all([compareAndSwap(a.pathname), compareAndSwap(b.pathname)]);
  if (results.filter((x) => x.outcome === 'committed').length !== 1 ||
      results.filter((x) => x.outcome === 'conflict').length !== 1) {
    throw new Error(`CAS race violation: ${results.map((x) => x.outcome).join('/')}`);
  }
  status.push('Concurrent ETag CAS: exactly one commit, one conflict');

  const committed = await meta(pointerPath);
  if (committed.etag === initial.etag) throw new Error('Head ETag did not change after CAS');
  const currentGet = await read(pointerPath);
  if (currentGet?.blob?.etag !== committed.etag) {
    status.push('Read-after-write: CDN lag observed; runtime must fail closed until consistent');
  } else {
    const body = JSON.parse(await new Response(currentGet.stream).text());
    if (body.ref !== a.pathname && body.ref !== b.pathname) throw new Error('Committed pointer has unexpected ref');
    status.push('Read-after-write: current pointer is immediately available');
  }

  await putNew(`${prefix}unreferenced.json`, payload('orphan'));
  if ((await meta(pointerPath)).etag !== committed.etag) throw new Error('Orphan write changed live diagnostic head');
  status.push('Interrupted-commit simulation: unreferenced revision did not affect head');
  for (const message of status) console.log(message);
  console.log(`PASS: disposable diagnostics only; prefix=${prefix}`);
  console.log('No objects were deleted. Keep the disposable store for inspection or remove it manually after verifying ownership.');
} catch (cause) {
  console.error(`FAIL: ${(cause instanceof Error ? cause.name : 'UnknownError')}: ${cause instanceof Error ? cause.message : 'Smoke test failed'}`);
  console.error(`Diagnostic prefix for manual inspection: ${prefix}`);
  process.exitCode = 1;
}
