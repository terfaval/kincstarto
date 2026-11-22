#!/usr/bin/env node
/** Shiori source gate. READ ONLY: neither local files nor Vercel Blob are written. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditShelfMap, compareShioriSources, summarizeShioriSource } from './shiori-source-audit-core.mjs';

function parseArgs(argv) {
  const args = { repository: 'data/spirit/library.json', shelves: 'src/components/spirit/shioriShelves.json' };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--live') { args.live = true; continue; }
    if (!['--repository', '--reference', '--shelves'].includes(flag) || !argv[index + 1]) {
      throw new Error(`Invalid argument: ${flag}. Supported: --repository FILE, --reference FILE, --shelves FILE, --live`);
    }
    args[flag.slice(2)] = argv[++index];
  }
  return args;
}

async function jsonFile(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function liveSource() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN; live Blob was NOT checked.');
  }
  const { get } = await import('@vercel/blob');
  const preferred = process.env.BLOB_ACCESS?.toLowerCase() === 'private' ? 'private' : 'public';
  let lastError = '';
  for (const access of [preferred, preferred === 'public' ? 'private' : 'public']) {
    try {
      const result = await get('spirit/library.json', { access });
      if (result?.statusCode === 200 && result.stream) {
        return JSON.parse(await new Response(result.stream).text());
      }
      lastError = `not found with ${access} access`;
    } catch (error) {
      const status = error?.statusCode ?? error?.status;
      const message = String(error?.message ?? '');
      if (status === 403 || status === 404 || /\b(403|404)\b/.test(message)) {
        lastError = `${access} access returned ${status || '403/404'}`;
        continue;
      }
      throw new Error(`Live Blob read failed (${error?.name || 'unknown error'}); no local fallback was used.`);
    }
  }
  throw new Error(`Live Blob catalog unavailable (${lastError}); no local fallback was used.`);
}

function printSource(result) {
  // No titles, status values, notes, path comments or secret configuration are printed.
  console.log(`${result.label}: ${result.bookCount} books, ${result.pathCount} paths, ${result.themeCount} themes, ${result.tagLabelCount} tag labels`);
  console.log(`  fingerprint SHA256: ${result.fingerprint}`);
  console.log(`  explicit related links: ${result.relatedReferences}, path book references: ${result.pathReferences}`);
  if (result.missingTagLabelCount) console.log(`  WARN: ${result.missingTagLabelCount} unique tags have no editorial label (non-blocking for legacy source).`);
  console.log(`  legacy personal field counts (no values): ${JSON.stringify(result.privateCounts)}`);
  for (const error of result.errors) console.error(`  ERROR: ${error}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = await jsonFile(args.repository);
  const map = await jsonFile(args.shelves);
  const sources = [{ label: 'repository', library: repo }];
  if (args.reference) sources.push({ label: 'reference', library: await jsonFile(args.reference) });
  if (args.live) sources.push({ label: 'live Blob', library: await liveSource() });
  let invalid = false;
  for (const source of sources) {
    const summary = summarizeShioriSource(source.library, source.label);
    printSource(summary);
    const shelfReport = auditShelfMap(source.library, map);
    console.log(`  7-shelf map: ${shelfReport.mappedIds} IDs; unassigned in source: ${shelfReport.booksWithoutShelf.length}; mapped IDs absent from source: ${shelfReport.configuredBooksMissingFromSource.length}`);
    for (const error of shelfReport.errors) console.error(`  ERROR: ${error}`);
    if (summary.errors.length || shelfReport.errors.length || shelfReport.booksWithoutShelf.length) invalid = true;
  }
  for (let i = 1; i < sources.length; i++) {
    const diff = compareShioriSources(sources[0].library, sources[i].library);
    console.log(`repository -> ${sources[i].label} differences (ID lists only):`);
    console.log(JSON.stringify({
      addedBookIds: diff.addedBookIds,
      missingBookIds: diff.missingBookIds,
      addedPathIds: diff.addedPathIds,
      missingPathIds: diff.missingPathIds,
      changedPublicFields: diff.changedPublicFields,
      changedEditorialPathCount: diff.changedEditorialPathCount,
    }, null, 2));
  }
  console.log('READ ONLY: no Blob writes, migrations, local file writes or backups were performed.');
  if (invalid) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`SHIORI SOURCE GATE FAILED: ${error.message}`);
  process.exitCode = 1;
});
