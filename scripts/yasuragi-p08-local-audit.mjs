#!/usr/bin/env node
/** P08: read-only local private Yasuragi inventory and checksum audit.
 * No Blob access; no write unless --manifest-out is explicitly provided.
 * A local PASS is NOT a production Blob backup/restore attestation.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digestRelease, publishedRelease, validHead, validRelease, PUBLICATION_ID, RELEASE_ID } from '../src/features/yasuragi/lib/practice-release-core.ts';

const DRAFT_RE = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;
const DRAFT_BASE_RE = /^[0-9]{13}-[0-9a-f-]{36}$/;
const HEX = /^[a-f0-9]{64}$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function children(dir) {
  try { return await readdir(dir, { withFileTypes: true }); }
  catch (err) { if (err?.code === 'ENOENT') return []; throw err; }
}

function requireRegular(entry, path) {
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Nem szabalyos fajl: ${path}`);
}

/** @returns {Promise<{format: string, entries: {path: string, sha256: string}[], sha256: string, counts: object, warnings: string[]}>} */
export async function auditLocalYasuragi(root) {
  const base = resolve(root);
  const entries = [];
  const warnings = [];
  const draftIds = new Set();
  const releaseByKey = new Map();
  const heads = [];
  let drafts = 0, receipts = 0, releases = 0, orphanReleases = 0;
  async function load(path, validate) {
    const buf = await readFile(path);
    const name = relative(base, path).split(sep).join('/');
    if (name.startsWith('..') || name.startsWith('/')) throw new Error('Fajl a privat konyvtaron kivul.');
    let value;
    try { value = JSON.parse(buf.toString('utf8')); }
    catch { throw new Error(`A helyi JSON fajl serult: ${name}`); }
    validate(value);
    entries.push({ path: name, sha256: hash(buf) });
    return value;
  }
  const draftDir = join(base, 'yasuragi-practice-drafts');
  for (const file of await children(draftDir)) {
    if (!DRAFT_RE.test(file.name)) throw new Error(`Ismeretlen tervezetfajl: ${file.name}`);
    requireRegular(file, file.name);
    await load(join(draftDir, file.name), (v) => {
      const content = v?.authoring ? { script: v.script, authoring: v.authoring } : v?.script;
      if (!content || v.draftId !== file.name || !HEX.test(v.sha256 ?? '') || hash(JSON.stringify(content)) !== v.sha256) {
        throw new Error(`Serult vagy valtozott tervezet: ${file.name}`);
      }
    });
    draftIds.add(file.name); drafts++;
  }
  const reviewDir = join(base, 'yasuragi-practice-reviews');
  for (const group of await children(reviewDir)) {
    if (!DRAFT_BASE_RE.test(group.name) || !group.isDirectory() || group.isSymbolicLink()) throw new Error(`Serult review mappa: ${group.name}`);
    const directory = join(reviewDir, group.name);
    for (const file of await children(directory)) {
      if (!DRAFT_RE.test(file.name)) throw new Error(`Ismeretlen naplofajl: ${file.name}`);
      requireRegular(file, file.name);
      await load(join(directory, file.name), (v) => {
        if (v?.format !== 'yasuragi.practice-review.v1' || v.receiptId !== file.name || v.draftId !== `${group.name}.json` ||
            !HEX.test(v.scriptSha256 ?? '') || !HEX.test(v.librarySha256 ?? '') ||
            v.attestations?.scriptReviewed !== true || v.attestations?.movementReviewed !== true ||
            v.attestations?.previewChecked !== true || v.kind !== 'editorial-signoff') {
          throw new Error(`Serult jovahagyasi naplo: ${group.name}/${file.name}`);
        }
      });
      if (!draftIds.has(`${group.name}.json`)) warnings.push('A jovahagyasi naplohoz nem talalhato helyi tervezet.');
      receipts++;
    }
  }
  const publicationDir = join(base, 'yasuragi-publications');
  const headDir = join(publicationDir, 'heads');
  const releaseDir = join(publicationDir, 'releases');
  for (const file of await children(headDir)) {
    if (!file.name.endsWith('.json') || !PUBLICATION_ID.test(file.name.slice(0, -5))) throw new Error(`Ismeretlen head fajl: ${file.name}`);
    requireRegular(file, file.name);
    const id = file.name.slice(0, -5);
    const value = await load(join(headDir, file.name), (v) => {
      if (!validHead(v, id)) throw new Error(`Serult kiadasfejlec: ${id}`);
    });
    heads.push(value);
  }
  for (const group of await children(releaseDir)) {
    if (!PUBLICATION_ID.test(group.name) || !group.isDirectory() || group.isSymbolicLink()) throw new Error(`Ismeretlen release mappa: ${group.name}`);
    const directory = join(releaseDir, group.name);
    for (const file of await children(directory)) {
      if (!RELEASE_ID.test(file.name)) throw new Error(`Ismeretlen kiadasfajl: ${file.name}`);
      requireRegular(file, file.name);
      const value = await load(join(directory, file.name), (v) => {
        if (!validRelease(v, group.name, file.name)) throw new Error(`Serult kiadas: ${group.name}/${file.name}`);
      });
      releaseByKey.set(`${group.name}/${file.name}`, value);
      releases++;
    }
  }
  const referenced = new Set();
  for (const head of heads) {
    const key = `${head.practiceId}/${head.releaseId}`;
    const record = releaseByKey.get(key);
    if (!record || head.releaseSha256 !== digestRelease(record) ||
        (head.status === 'published' && !publishedRelease(head, record))) {
      throw new Error(`A kiadasfejlec nem egyezik a pillanatkeppel: ${head.practiceId}`);
    }
    referenced.add(key);
  }
  for (const key of releaseByKey.keys()) if (!referenced.has(key)) orphanReleases++;
  if (orphanReleases) warnings.push(`${orphanReleases} korabbi vagy CAS utan nem aktivalt immutable pillanatkep talalhato; ez nem feltetlenul hiba.`);
  entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const digest = hash(entries.map((x) => `${x.path}\0${x.sha256}\n`).join(''));
  return {
    format: 'yasuragi.local-integrity-manifest.v1', entries, sha256: digest,
    counts: { drafts, receipts, heads: heads.length, releases, orphanReleases }, warnings,
  };
}

async function main(args) {
  let root = join(process.cwd(), 'private');
  let manifestOut = null, verifyManifest = null;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (['--root', '--manifest-out', '--verify-manifest'].includes(key) && !args[i + 1]) throw new Error(`Hianyzik az ertek: ${key}`);
    if (key === '--root') root = args[++i];
    else if (key === '--manifest-out') manifestOut = args[++i];
    else if (key === '--verify-manifest') verifyManifest = args[++i];
    else throw new Error(`Ismeretlen argumentum: ${key}`);
  }
  if (manifestOut && verifyManifest) throw new Error('A manifest iras es ellenorzes kulon lepes legyen.');
  const report = await auditLocalYasuragi(root);
  if (verifyManifest) {
    const previous = JSON.parse(await readFile(resolve(verifyManifest), 'utf8'));
    if (previous?.format !== report.format || previous.sha256 !== report.sha256 ||
        JSON.stringify(previous.entries) !== JSON.stringify(report.entries)) throw new Error('A forras es a mentett manifest nem egyezik.');
    console.log('PASS: a helyi fajlok es a manifest egyeznek.');
  }
  if (manifestOut) {
    const output = resolve(manifestOut);
    await writeFile(output, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log('A helyi ellenorzo manifest letrejott (tartalmat nem exportal).');
  }
  const empty = report.entries.length === 0;
  console.log(JSON.stringify({ result: empty ? 'NO_LOCAL_DATA' : 'LOCAL_AUDIT_PASS', sha256: report.sha256, counts: report.counts,
    warnings: [...report.warnings, ...(empty ? ['Nincs helyi privát adat; ez nem a távoli tároló ellenőrzése.'] : [])],
    scope: 'local-only; NOT a production Blob backup or restore test' }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((cause) => {
    console.error(`YASURAGI_P08_BLOCKED: ${cause instanceof Error ? cause.message : 'ismeretlen hiba'}`);
    process.exitCode = 1;
  });
}
