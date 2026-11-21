import assert from 'node:assert/strict';
import test from 'node:test';
import { latestPoseRevision, findLatestPoseRevision, YOGI_POSE_REVISION_PREFIX as prefix } from '../src/lib/yogiPoseRevisionCore.ts';

const item = (name) => ({ pathname: `${prefix}${name}`, url: `https://example.test/${prefix}${name}` });
const uuid = '123e4567-e89b-12d3-a456-426614174000';

test('select newest immutable revision by sortable pathname, not returned listing order', () => {
  const older = item(`2026-11-21T10-00-00-000Z-${uuid}.json`);
  const newer = item(`2026-11-21T11-00-00-000Z-${uuid}.json`);
  assert.deepEqual(latestPoseRevision([newer, older]), newer);
  assert.deepEqual(latestPoseRevision([older, newer]), newer);
});

test('ignore unrelated Blob objects and reject misleading lookalike paths', () => {
  const valid = item(`2026-11-21T10-00-00-000Z-${uuid}.json`);
  assert.deepEqual(latestPoseRevision([
    {pathname: 'yogi/poses.json', url: 'x'},
    {pathname: `${prefix}../fake.json`, url: 'x'},
    {pathname: `${prefix}2026-99-99.json`, url: 'x'},
    valid,
  ]), valid);
  assert.equal(latestPoseRevision([]), null);
});


test('finds latest across multiple Blob list pages, instead of trusting a stale canonical filename', async () => {
  const old = item(`2026-11-21T10-00-00-000Z-${uuid}.json`);
  const current = item(`2026-11-21T11-15-00-000Z-${uuid}.json`);
  const calls = [];
  const latest = await findLatestPoseRevision(async (cursor) => {
    calls.push(cursor ?? 'first');
    if (!cursor) return { blobs: [old], hasMore: true, cursor: 'p2' };
    return { blobs: [current], hasMore: false };
  });
  assert.deepEqual(calls, ['first', 'p2']);
  assert.deepEqual(latest, current);
});

test('refuses pagination loops instead of silently reading older records', async () => {
  await assert.rejects(() => findLatestPoseRevision(async () => ({
    blobs: [item(`2026-11-21T10-00-00-000Z-${uuid}.json`)],
    hasMore: true,
    cursor: 'same',
  })), /did not advance/);
});
