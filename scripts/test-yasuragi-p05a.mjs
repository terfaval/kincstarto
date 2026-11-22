import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getProjectReview } from '../src/features/yasuragi/lib/practice-review.ts';
import { evaluatePublicationGate, reviewReceiptIsCurrent } from '../src/features/yasuragi/lib/practice-publication.ts';

const poseId = 'pose_mountain_pose';
const script = { practiceId: 'p05_test', version: '0.1', startNodeId: 's', endNodeId: 'END', nodes: [
  { id: 's', type: 'segment', posePool: [poseId], nextNodeId: 'END' },
] };
const readyReport = { ok: true, errors: [], availableRouteCount: 1, previewReady: true };
const pose = () => ({ id: poseId, slug: 'mountain_pose', name_hu: 'Hegyal', status: 'active', content_status: 'verified', validated: true,
  summary: 'Original verified description', setup: 'Stand with feet placed comfortably', contraindications: [],
  mannequin_angled: { status: 'verified', asset_ref: 'pose-image.png' },
});
const state = (p) => {
  const gate = evaluatePublicationGate(script, readyReport, getProjectReview(script, [], [p]));
  const sha = createHash('sha256').update(JSON.stringify(gate.libraryFingerprintInput)).digest('hex');
  return { gate, sha };
};

test('P05a: unchanged canonical pose keeps the exact approval library hash', () => {
  const a = state(pose());
  const b = state(pose());
  assert.equal(a.gate.eligible, true);
  assert.equal(a.sha, b.sha);
  assert.equal(a.gate.libraryFingerprintInput[0].contentDigest.length, 64);
});

test('P05a: changing pose teaching text invalidates existing review receipt', () => {
  const a = state(pose());
  const b = state({ ...pose(), setup: 'Changed entry and setup after previous review' });
  assert.notEqual(a.sha, b.sha);
  const receipt = { scriptSha256: 'script-version', librarySha256: a.sha };
  assert.equal(reviewReceiptIsCurrent(b.gate, receipt, 'script-version', b.sha), false);
});

test('P05a: contraindication and illustration changes also change library hash', () => {
  const a = state(pose());
  assert.notEqual(a.sha, state({ ...pose(), contraindications: ['A new caution'] }).sha);
  assert.notEqual(a.sha, state({ ...pose(), mannequin_angled: { status: 'verified', asset_ref: 'replacement-image.png' } }).sha);
});

test('P05a: unreadable/malformed pose catalogue must not be silently seeded', () => {
  const source = readFileSync('src/lib/yogiKnowledgeStore.ts', 'utf8');
  // P05c supersedes the P05a generic JSON fallback with strict remote
  // migration, while local files still use the fail-closed P05b reader.
  assert.match(source, /return readLegacyYogiPoseBlobSnapshot\(\)/);
  assert.match(source, /return readLocalPoseSnapshot\(COLLECTIONS\.poses\.filePath\)/);
  const revision = readFileSync('src/lib/yogiPoseRevisionStore.ts', 'utf8');
  assert.match(revision, /if \(raw !== null && !Array\.isArray\(raw\)\)/);
  assert.match(revision, /selectLegacyPoseSource\(latest, canonical\)/);
});

test('P05a: production pose saves require configured durable Blob storage', () => {
  const source = readFileSync('src/lib/yogiKnowledgeStore.ts', 'utf8');
  assert.match(source, /process\.env\.NODE_ENV\s*===\s*"production"\s*&&\s*!isBlobEnabled\(\)/);
  assert.match(source, /throw new Error\("Durable pose storage is unavailable in production"\)/);
});
