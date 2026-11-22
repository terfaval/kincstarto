import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { planPracticeWorkflow, createWorkflowReport } from '../src/features/yasuragi/lib/practice-workflow.ts';
import { auditLocalYasuragi } from './yasuragi-p08-local-audit.mjs';
import { digestRelease, HEAD_FORMAT, RELEASE_FORMAT } from '../src/features/yasuragi/lib/practice-release-core.ts';

const sha = (x) => createHash('sha256').update(x).digest('hex');
const id = `1763000000000-00000000-0000-4000-8000-000000000001.json`;
const releaseId = `1763000000001-00000000-0000-4000-8000-000000000002.json`;
const eligible = { eligible: true, requiredPoseCount: 2, blockers: [] };

test('P07 refuses publication unless gate, exact manual receipt, and storage state all pass', () => {
  assert.equal(planPracticeWorkflow({ gate: null, receiptCurrent: true, publication: { status: 'none' } }).phase, 'loading');
  const gate = { ...eligible, eligible: false, blockers: [{ code: 'POSE_MISSING', label: 'Hianyzik', poseId: 'a' }] };
  assert.deepEqual(planPracticeWorkflow({ gate, receiptCurrent: true, publication: { status: 'none' } }).actions.map(x => x.code), ['POSE_MISSING']);
  assert.equal(planPracticeWorkflow({ gate: eligible, receiptCurrent: false, publication: { status: 'none' } }).phase, 'manual_review');
  assert.equal(planPracticeWorkflow({ gate: eligible, receiptCurrent: true, publication: null }).phase, 'storage_unavailable');
  const ready = planPracticeWorkflow({ gate: eligible, receiptCurrent: true, publication: { status: 'revoked' } });
  assert.equal(ready.phase, 'ready_to_publish');
  assert.equal(ready.canRequestPublication, true);
  const stale = planPracticeWorkflow({ gate: eligible, receiptCurrent: true, publication: { status: 'published', publiclyAccessible: false } });
  assert.equal(stale.phase, 'stale_release');
  assert.equal(stale.canRequestPublication, true);
  assert.equal(planPracticeWorkflow({ gate: eligible, receiptCurrent: true, publication: { status: 'published', publiclyAccessible: true } }).phase, 'published');
});

test('P07 exports only bounded metadata and actionable steps; never draft script or secret', () => {
  const report = createWorkflowReport({
    draftId: id, practiceId: 'test_yasuragi', version: '1', scriptSha256: sha('script'),
    librarySha256: sha('library'), gate: eligible, receiptCurrent: true,
    publication: { status: 'none' }, createdAt: '2026-11-22T00:00:00.000Z',
  });
  assert.equal(report.advisoryOnly, true);
  assert.equal(report.phase, 'ready_to_publish');
  assert.equal(report.requiredPoseCount, 2);
  assert.deepEqual(Object.keys(report).sort().includes('script'), false);
  assert(!JSON.stringify(report).includes('BLOB_READ_WRITE_TOKEN'));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'yas-p08-'));
  const draft = { draftId: id, createdAt: '2026-11-22T00:00:00.000Z', script: { practiceId: 'p1', durationSec: 900 } };
  draft.sha256 = sha(JSON.stringify(draft.script));
  const script = { practiceId: 'p1', durationSec: 900, version: 'v1', nodes: [] };
  const release = { format: RELEASE_FORMAT, releaseId, practiceId: 'p1', version: 'v1', title: 'Teszt',
    durationSec: 900, publishedAt: '2026-11-22T00:00:00.000Z', librarySha256: sha('poses'), script, poses: {} };
  const head = { format: HEAD_FORMAT, practiceId: 'p1', releaseId, status: 'published',
    releaseSha256: digestRelease(release), updatedAt: '2026-11-22T00:00:00.000Z' };
  await mkdir(join(root, 'yasuragi-practice-drafts'), { recursive: true });
  await writeFile(join(root, 'yasuragi-practice-drafts', id), JSON.stringify(draft));
  await mkdir(join(root, 'yasuragi-practice-reviews', id.slice(0, -5)), { recursive: true });
  const receiptId = '1763000000002-00000000-0000-4000-8000-000000000003.json';
  await writeFile(join(root, 'yasuragi-practice-reviews', id.slice(0, -5), receiptId), JSON.stringify({
    format: 'yasuragi.practice-review.v1', receiptId, draftId: id,
    scriptSha256: draft.sha256, librarySha256: sha('poses'), createdAt: '2026-11-22T00:00:00.000Z',
    kind: 'editorial-signoff', attestations: { scriptReviewed: true, movementReviewed: true, previewChecked: true },
  }));
  await mkdir(join(root, 'yasuragi-publications', 'heads'), { recursive: true });
  await mkdir(join(root, 'yasuragi-publications', 'releases', 'p1'), { recursive: true });
  await writeFile(join(root, 'yasuragi-publications', 'heads', 'p1.json'), JSON.stringify(head));
  const releaseFile = join(root, 'yasuragi-publications', 'releases', 'p1', releaseId);
  await writeFile(releaseFile, JSON.stringify(release));
  return { root, releaseFile, release, head };
}

test('P08 local inventory verifies draft, receipt, snapshot and head as one immutable set', async () => {
  const f = await fixture();
  try {
    const report = await auditLocalYasuragi(f.root);
    assert.deepEqual(report.counts, { drafts: 1, receipts: 1, heads: 1, releases: 1, orphanReleases: 0 });
    assert.equal(report.entries.length, 4);
    assert.match(report.sha256, /^[a-f0-9]{64}$/);
    const again = await auditLocalYasuragi(f.root);
    assert.equal(report.sha256, again.sha256);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('P08 catches a modified immutable release without touching the stored file', async () => {
  const f = await fixture();
  try {
    const changed = { ...f.release, title: 'Tampered' };
    await writeFile(f.releaseFile, JSON.stringify(changed));
    await assert.rejects(() => auditLocalYasuragi(f.root), /nem egyezik/);
    assert.equal(JSON.parse(await readFile(f.releaseFile, 'utf8')).title, 'Tampered');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('P08 reports historical/orphaned immutable snapshots without deleting them; revocation remains valid', async () => {
  const f = await fixture();
  try {
    const orphan = { ...f.release, releaseId: '1763000000003-00000000-0000-4000-8000-000000000004.json' };
    await writeFile(join(f.root, 'yasuragi-publications', 'releases', 'p1', orphan.releaseId), JSON.stringify(orphan));
    f.head.status = 'revoked';
    await writeFile(join(f.root, 'yasuragi-publications', 'heads', 'p1.json'), JSON.stringify(f.head));
    const report = await auditLocalYasuragi(f.root);
    assert.equal(report.counts.orphanReleases, 1);
    assert.equal(report.warnings.length, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('P08 manifest round-trip verifies copied data and rejects a changed version', async () => {
  const f = await fixture();
  try {
    const script = resolve('scripts/yasuragi-p08-local-audit.mjs');
    const manifest = join(f.root, 'manifest.json');
    const run = (args) => spawnSync(process.execPath, ['--experimental-strip-types', script, '--root', f.root, ...args], { encoding: 'utf8' });
    const created = run(['--manifest-out', manifest]);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(run(['--verify-manifest', manifest]).status, 0);
    const d = JSON.parse(await readFile(join(f.root, 'yasuragi-practice-drafts', id), 'utf8'));
    d.script.title = 'changed';
    d.sha256 = sha(JSON.stringify(d.script));
    await writeFile(join(f.root, 'yasuragi-practice-drafts', id), JSON.stringify(d));
    const checked = run(['--verify-manifest', manifest]);
    assert.equal(checked.status, 1);
    assert.match(checked.stderr, /nem egyezik/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
