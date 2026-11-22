#!/usr/bin/env node
/**
 * Shiori 04C/4: read-only preflight by default; --apply makes exactly one
 * interactive, ETag-conditional production write. --postcheck reads only.
 * No automatic retry or rollback is performed after an ambiguous response.
 */
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  verifyRecoveryBundle, shaObject, EXPECTED_CANDIDATE_SHA,
  readVersionCheckedBlob, conditionalWrite, verifyWriteMetadata,
} from './shiori-recovery-promotion-core.mjs';

const OBJECT_PATH = 'spirit/library.json';
const ACK_PHRASE = 'SHIORI 86 KONYV VISSZAALLITAS';

function parseArgs(args) {
  if (![2, 3].includes(args.length) || args[0] !== '--recovery-dir' || !args[1] || (args.length === 3 && !['--apply', '--postcheck'].includes(args[2]))) {
    throw new Error('Usage: --recovery-dir ABSOLUTE_DIRECTORY [--apply | --postcheck]');
  }
  if (!isAbsolute(args[1])) throw new Error('Recovery directory must be absolute');
  const dir = resolve(args[1]);
  const rel = relative(process.cwd(), dir);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Recovery directory must be outside the repository');
  return { dir, mode: args[2] === '--apply' ? 'apply' : args[2] === '--postcheck' ? 'postcheck' : 'preflight' };
}

async function loadBundle(dir) {
  const paths = [
    join(dir, 'LIVE_spirit_library_BACKUP.json'),
    join(dir, 'SHIORI_MERGE_CANDIDATE_NOT_FOR_UPLOAD.json'),
    join(dir, 'SHIORI_MERGE_REPORT.json'),
  ];
  for (const pathname of paths) {
    const info = await stat(pathname);
    if (!info.isFile()) throw new Error(`Missing recovery file: ${pathname}`);
  }
  const [backupRaw, candidateRaw, reportRaw] = await Promise.all(paths.map(path => readFile(path, 'utf8')));
  const manifest = JSON.parse(reportRaw);
  // Verify the bundle even for --postcheck; never trust the candidate without the approved fingerprints.
  verifyRecoveryBundle({ backupRaw, candidateRaw, manifest, liveRaw: backupRaw });
  return { backupRaw, candidateRaw, manifest };
}

async function readLive(blobClient) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN missing');
  const preferred = process.env.BLOB_ACCESS?.toLowerCase() === 'private' ? 'private' : 'public';
  for (const access of [preferred, preferred === 'private' ? 'public' : 'private']) {
    try {
      const verified = await readVersionCheckedBlob(blobClient, OBJECT_PATH, access);
      if (verified) {
        if (verified.cacheBusted) {
          console.log('PUBLIC CDN RECHECK: a fresh URL returned the same version as origin HEAD.');
        }
        return verified;
      }
    } catch (error) {
      const msg = String(error?.message || '');
      if (![403, 404].includes(error?.statusCode ?? error?.status) && !/\b(403|404)\b/.test(msg)) throw error;
    }
  }
  throw new Error('Live Blob cannot be read; no local fallback permitted');
}

async function savePrewriteSnapshot(dir, live) {
  // Unique private local folder, no overwrite. Keep this even when the upload fails ambiguously.
  const destination = join(dir, `PREWRITE_${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID()}`);
  await mkdir(destination, { recursive: false, mode: 0o700 });
  await writeFile(join(destination, 'LIVE_spirit_library_BEFORE_WRITE.json'), live.raw, { flag: 'wx', mode: 0o600 });
  await writeFile(join(destination, 'PREWRITE_METADATA.json'), JSON.stringify({
    pathname: OBJECT_PATH, access: live.access, etag: live.etag, sha256: shaObject(JSON.parse(live.raw)),
    recordedAt: new Date().toISOString(), note: 'Private local recovery evidence. Never upload or commit.',
  }, null, 2), { flag: 'wx', mode: 0o600 });
  return destination;
}

async function main() {
  const { dir, mode } = parseArgs(process.argv.slice(2));
  const bundle = await loadBundle(dir);
  const blobClient = await import('@vercel/blob');
  const live = await readLive(blobClient);
  const fingerprint = shaObject(JSON.parse(live.raw));

  if (mode === 'postcheck') {
    if (fingerprint !== EXPECTED_CANDIDATE_SHA) {
      throw new Error(`POSTCHECK INCOMPLETE: expected 86-book candidate, got SHA ${fingerprint}. CDN may need up to 60 seconds. READ ONLY; do NOT re-upload.`);
    }
    const restored = JSON.parse(live.raw);
    if (restored.books?.length !== 86 || restored.paths?.length !== 8) throw new Error('Postcheck book/path counts disagree with candidate');
    console.log('POSTCHECK VERIFIED: live Blob contains exactly the approved 86-book / 8-path candidate.');
    console.log(`LIVE SHA256: ${fingerprint}`);
    console.log('READ ONLY. Preserve the backup and private receipt.');
    return;
  }

  const result = verifyRecoveryBundle({ ...bundle, liveRaw: live.raw });
  console.log('VERIFIED: live source, local backup, manifest, candidate and Blob version match.');
  console.log(`LIVE SHA256: ${result.liveSha}`);
  console.log(`CANDIDATE SHA256: ${result.candidateSha}`);
  console.log(`BOOKS: 59 -> ${result.books}; PATHS: 4 -> ${result.paths}; PERSONAL FIELDS: existing records preserved.`);
  console.log(`ACCESS: ${live.access}; OBJECT: ${OBJECT_PATH}; GET/HEAD ETAGS: MATCH`);

  if (mode === 'preflight') {
    console.log('READ ONLY. Conditional ETag upload is prepared but not authorized by this command.');
    return;
  }

  if (!input.isTTY || !output.isTTY) throw new Error('An interactive local terminal is required for --apply');
  console.log('WARNING: ONE REAL PRODUCTION WRITE of spirit/library.json (86 books, 8 paths).');
  console.log('Suspend all Shiori admin edits before authorizing. Keep both local backups.');
  const rl = createInterface({ input, output });
  let answer;
  try { answer = await rl.question(`Type exactly "${ACK_PHRASE}" to authorize one conditional overwrite: `); }
  finally { rl.close(); }
  if (answer !== ACK_PHRASE) throw new Error('No overwrite: confirmation was not exact');

  // Re-read after approval; both content hash and the actual version ETag must match.
  const before = await readLive(blobClient);
  verifyRecoveryBundle({ ...bundle, liveRaw: before.raw });
  if (before.access !== live.access || before.etag !== live.etag) throw new Error('Live Blob version/access changed during confirmation');
  const evidenceDir = await savePrewriteSnapshot(dir, before);
  console.log(`Private prewrite evidence: ${evidenceDir}`);
  console.log('Starting exactly ONE ifMatch-conditional write. No automatic retry.');

  // The Vercel Blob service enforces ifMatch atomically; concurrent modifications cause HTTP 412.
  let upload;
  try {
    upload = await conditionalWrite(blobClient, {
      pathname: OBJECT_PATH, raw: bundle.candidateRaw, access: before.access, etag: before.etag,
    });
  } catch (error) {
    const message = String(error?.message || '');
    if (error?.name === 'BlobPreconditionFailedError' || error?.statusCode === 412 || /\b412\b/.test(message)) {
      throw new Error('CONCURRENT CHANGE DETECTED (ETag/412). The conditional upload was refused. Re-audit; do not retry.');
    }
    throw new Error(`UPLOAD OUTCOME UNKNOWN (${message}). DO NOT RETRY. Run --postcheck and inspect the Blob before doing anything else.`);
  }
  // Record the acknowledged write immediately: if subsequent verification is inconclusive,
  // the recorded ETag is useful for investigation. Never auto-retry or auto-rollback.
  await writeFile(join(evidenceDir, 'UPLOAD_RESPONSE.json'), JSON.stringify({
    pathname: OBJECT_PATH, responseEtag: upload?.etag ?? null, acknowledgedAt: new Date().toISOString(),
    warning: 'A response does not prove CDN propagation. Never repeat --apply automatically.',
  }, null, 2), { flag: 'wx', mode: 0o600 });
  // Verify against the Blob control-plane HEAD, never a potentially stale public CDN GET.
  try {
    const after = await blobClient.head(OBJECT_PATH);
    verifyWriteMetadata({ beforeEtag: before.etag, response: upload, after, candidateRaw: bundle.candidateRaw });
  } catch (error) {
    throw new Error(`POST-WRITE VERIFICATION INCONCLUSIVE: ${error.message}. DO NOT RETRY --apply; use --postcheck after propagation.`);
  }
  await writeFile(join(evidenceDir, 'WRITE_RECEIPT.json'), JSON.stringify({
    pathname: OBJECT_PATH, oldSha256: result.liveSha, newSha256: result.candidateSha,
    oldEtag: before.etag, newEtag: upload.etag, confirmedAt: new Date().toISOString(),
    note: 'Upload acknowledged and HEAD verified. CDN content still requires --postcheck.',
  }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('ONE CONDITIONAL WRITE ACCEPTED: origin ETag and byte count verified.');
  console.log('PUBLIC CDN MAY SERVE OLD DATA UP TO 60 SECONDS. Run --postcheck separately; never retry --apply.');
}
main().catch((error) => {
  console.error(`SHIORI RECOVERY STOPPED: ${error.message}`);
  process.exitCode = 1;
});
