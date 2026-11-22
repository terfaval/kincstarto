#!/usr/bin/env node
/** Shiori: source/metadata diagnostic only. No put/copy/del, no local writes. */
import { randomUUID } from 'node:crypto';
import { diagnose } from './shiori-blob-version-diagnostic-core.mjs';

async function main() {
  if (process.argv.length !== 2) throw new Error('This diagnostic accepts no arguments');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN missing');
  const blob = await import('@vercel/blob');
  const result = await diagnose(blob, { nonce: randomUUID });
  console.log(JSON.stringify(result, null, 2));
  console.log('READ ONLY: no Blob writes, local writes, tokens or personal notes printed.');
  if (!result.comparisons.contentMatchesPinned || !result.comparisons.headMatchesPinned) process.exitCode = 2;
}
main().catch(error => {
  console.error(`SHIORI BLOB DIAGNOSTIC STOPPED: ${error.message}`);
  process.exitCode = 1;
});
