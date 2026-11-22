import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { selectLegacyPoseSource, poseRevisionToken } from '../src/lib/yogiPoseConcurrency.ts';

const root = resolve(import.meta.dirname, '..');
const source = (path) => readFile(join(root, path), 'utf8');

test('P05c: migration selects an unambiguous remote source and preserves its content', () => {
  const poses = [{ id: 'pose_a', summary: 'baseline' }];
  assert.deepEqual(selectLegacyPoseSource(poses, null), poses);
  assert.deepEqual(selectLegacyPoseSource(null, poses), poses);
  assert.deepEqual(selectLegacyPoseSource(poses, structuredClone(poses)), poses);
  assert.equal(poseRevisionToken('legacy', selectLegacyPoseSource(poses, null)), poseRevisionToken('legacy', poses));
});

test('P05c: divergent or missing remote sources cannot initialize the head', () => {
  const a = [{ id: 'pose_a' }];
  const b = [{ id: 'pose_b' }];
  assert.throws(() => selectLegacyPoseSource(a, b), /manual reconciliation required/);
  assert.throws(() => selectLegacyPoseSource(null, null), /refusing local fallback/);
  assert.deepEqual(selectLegacyPoseSource([], []), []); // an explicitly stored empty catalogue differs from a missing one
});

test('P05c: Blob head absence is handled explicitly; auth/store errors remain errors', async () => {
  const storage = await source('src/lib/yogiPoseRevisionStore.ts');
  assert.match(storage, /BlobNotFoundError/);
  assert.match(storage, /cause instanceof BlobNotFoundError\) return null/);
  assert.match(storage, /throw cause/);
  assert.match(storage, /const after = await head\(HEAD_PATH\)/);
  assert.match(storage, /after\.etag !== info\.etag/);
  assert.match(storage, /selectLegacyPoseSource\(latest, canonical\)/);
});

test('P05c: Blob bootstrap cannot seed from local file, fallback or empty array', async () => {
  const facade = await source('src/lib/yogiKnowledgeStore.ts');
  const start = facade.indexOf('async function readRawPoseSnapshot()');
  const end = facade.indexOf('async function readPoseSnapshot()', start);
  const raw = facade.slice(start, end);
  assert.match(raw, /readYogiPoseBlobSnapshot\(\)/);
  assert.match(raw, /return readLegacyYogiPoseBlobSnapshot\(\)/);
  assert.doesNotMatch(raw.slice(0, raw.indexOf("return readLocalPoseSnapshot")), /readJsonStore|fallbackValue|filePath/);
});

test('P05c: 409 leaves draft text in place and forbids automatic replay', async () => {
  const ui = await source('src/components/yogi/YogiKnowledgeAdmin.tsx');
  const save = ui.slice(ui.indexOf('const handleSave = async'), ui.indexOf('const handleSave = async') + 3000);
  assert.match(save, /response\.status === 409/);
  assert.match(save, /A szerkesztett JSON itt megmaradt/);
  assert.doesNotMatch(save, /setDraftText\(""\)|location\.reload|window\.location\.reload/);
});

test('P05c: disposable Blob script cannot address live yogi paths', async () => {
  const smoke = await source('scripts/yasuragi-p05c-disposable-blob.mjs');
  assert.match(smoke, /YASURAGI_P05C_DISPOSABLE_BLOB_TOKEN/);
  assert.match(smoke, /YES_DISPOSABLE_STORE/);
  assert.match(smoke, /diagnostics\/yasuragi-p05c/);
  assert.doesNotMatch(smoke, /\bdel\(|yogi\/pose-revisions\/head-v1\.json|yogi\/poses\.json/);
});

test('P05c: live-store preflight is read-only and checks both head and legacy state', async () => {
  const preflight = await source('scripts/yasuragi-p05c-readonly-preflight.mjs');
  assert.match(preflight, /YASURAGI_P05C_READONLY_TOKEN/);
  assert.match(preflight, /head-v1\.json/);
  assert.match(preflight, /yogi\/poses\.json/);
  assert.match(preflight, /manual reconciliation required/);
  assert.doesNotMatch(preflight, /\bput\(|\bdel\(|\bcopy\(/);
});
