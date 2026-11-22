#!/usr/bin/env node
/** Never writes to Blob. Saves live backup and a proposed local candidate outside the repository. */
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { makeShioriRecoveryCandidate, validateLinks } from './shiori-recovery-core.mjs';

function argsFrom(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!['--reference', '--output-dir', '--expect-live-sha'].includes(key) || !argv[i + 1]) {
      throw new Error('Usage: --reference FILE --output-dir NEW_DIRECTORY --expect-live-sha SHA256');
    }
    options[key.slice(2)] = argv[++i];
  }
  if (!options.reference || !options['output-dir'] || !/^[a-f0-9]{64}$/i.test(options['expect-live-sha'] || '')) {
    throw new Error('Required: --reference FILE --output-dir NEW_DIRECTORY --expect-live-sha 64_HEX_CHARACTERS');
  }
  return options;
}
const fingerprint = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const rawHash = (text) => createHash('sha256').update(text).digest('hex');

async function readLive() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is missing');
  const { get } = await import('@vercel/blob');
  const requested = process.env.BLOB_ACCESS?.toLowerCase() === 'private' ? 'private' : 'public';
  for (const access of [requested, requested === 'private' ? 'public' : 'private']) {
    try {
      const result = await get('spirit/library.json', { access });
      if (result?.statusCode === 200 && result.stream) {
        const raw = await new Response(result.stream).text();
        return { raw, data: JSON.parse(raw) };
      }
    } catch (error) {
      const status = error?.statusCode ?? error?.status;
      const message = String(error?.message ?? '');
      if (![403, 404].includes(status) && !/\b(403|404)\b/.test(message)) throw error;
    }
  }
  throw new Error('The live Blob catalog could not be read; no local fallback will be used');
}

async function main() {
  const opts = argsFrom(process.argv.slice(2));
  const referenceFile = resolve(opts.reference);
  const out = resolve(opts['output-dir']);
  const repo = process.cwd();
  const rel = relative(repo, out);
  if (!isAbsolute(opts['output-dir'])) throw new Error('Output directory must be an ABSOLUTE path outside the repository');
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) {
    throw new Error('Output directory must be OUTSIDE the repository to avoid adding personal data to Git');
  }
  try {
    await stat(out);
    throw new Error('Output directory already exists. Use a fresh directory so no backup is overwritten.');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const { raw, data: live } = await readLive();
  const liveSha = fingerprint(live);
  const reference = JSON.parse(await readFile(referenceFile, 'utf8'));
  validateLinks(live);
  validateLinks(reference);
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out, { recursive: false });
  await writeFile(resolve(out, 'LIVE_spirit_library_BACKUP.json'), raw, { flag: 'wx', mode: 0o600 });
  if (liveSha.toLowerCase() !== opts['expect-live-sha'].toLowerCase()) {
    console.error('LIVE SOURCE CHANGED SINCE AUDIT; backup saved but NO merge candidate created.');
    console.error(`Current fingerprint: ${liveSha}`);
    console.error(`Raw backup: ${resolve(out, 'LIVE_spirit_library_BACKUP.json')}`);
    process.exitCode = 2;
    return;
  }
  const { candidate, report } = makeShioriRecoveryCandidate(live, reference);
  const resultSha = fingerprint(candidate);
  await writeFile(resolve(out, 'SHIORI_MERGE_CANDIDATE_NOT_FOR_UPLOAD.json'), JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const manifest = {
    operation: 'LOCAL_BACKUP_AND_MERGE_PREVIEW_ONLY_NO_BLOB_WRITES',
    liveFingerprint: liveSha,
    liveRawSha256: rawHash(raw),
    referenceFingerprint: fingerprint(reference),
    resultFingerprint: resultSha,
    report,
    warning: 'Candidate not reviewed or approved for upload. Existing editorials prefer live; existing personal data retained. Do not commit either JSON.',
  };
  await writeFile(resolve(out, 'SHIORI_MERGE_REPORT.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('LIVE BACKUP AND DRY-RUN MERGE CREATED LOCALLY (no Vercel Blob writes).');
  console.log(`Live fingerprint: ${liveSha}`);
  console.log(`Candidate fingerprint: ${resultSha}`);
  console.log(`Books: ${report.originalBooks} -> ${report.resultBooks}; paths: ${report.originalPaths} -> ${report.resultPaths}`);
  console.log(`Related lists enriched: ${report.relatedListsExpanded.length}; existing personal book records preserved: ${report.existingBooksPreserved}; existing paths preserved: ${report.existingPathsPreserved}`);
  console.log(`Reference-only editorial changes held for separate review: ${JSON.stringify(report.commonEditorialDifferencesNotApplied)}`);
  console.log(`Existing paths with editorial differences held for separate review: ${report.commonPathEditorialDifferencesNotApplied.length}`);
  console.log(`Output directory: ${out}`);
  console.log('DO NOT UPLOAD, COMMIT, OR SHARE THE RAW BACKUP OR CANDIDATE: they contain personal reading data.');
}
main().catch(error => { console.error(`SHIORI RECOVERY PREVIEW FAILED: ${error.message}`); process.exitCode = 1; });
