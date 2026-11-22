import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  readLocalPoseSnapshot, commitLocalPoseSnapshot, poseRevisionToken,
  assertPoseRevision, PoseRevisionConflict, commitPosePointerVersion,
} from '../src/lib/yogiPoseConcurrency.ts';

async function withCatalogue(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'yasuragi-p05b-'));
  const path = join(dir, 'poses.json');
  await writeFile(path, '[{"id":"pose_a","summary":"original"}]\n', 'utf8');
  try { return await fn(path); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('P05b local snapshots expose a stable version and reject stale writes', async () => {
  await withCatalogue(async (path) => {
    const initial = await readLocalPoseSnapshot(path);
    assert.equal(initial.revision, poseRevisionToken('local', initial.poses));
    const newRevision = await commitLocalPoseSnapshot(path, [{ id:'pose_a', summary:'first' }], initial.revision);
    assert.notEqual(newRevision, initial.revision);
    await assert.rejects(commitLocalPoseSnapshot(path, [{ id:'pose_a', summary:'stale' }], initial.revision), PoseRevisionConflict);
    assert.equal((await readLocalPoseSnapshot(path)).poses[0].summary, 'first');
  });
});

test('P05b concurrent local writers allow exactly one full snapshot', async () => {
  await withCatalogue(async (path) => {
    const snapshot = await readLocalPoseSnapshot(path);
    const attempts = await Promise.allSettled(['alpha','beta','gamma'].map((value) =>
      commitLocalPoseSnapshot(path, [{ id:'pose_a', summary:value }], snapshot.revision)
    ));
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((r) => r.status === 'rejected' && r.reason instanceof PoseRevisionConflict).length, 2);
    const current = await readLocalPoseSnapshot(path);
    assert.ok(['alpha','beta','gamma'].includes(current.poses[0].summary));
    assert.equal(current.poses.length, 1);
  });
});

test('P05b refuses corrupt/missing catalogue and preserves data on revision conflict', async () => {
  await withCatalogue(async (path) => {
    const before = await readFile(path, 'utf8');
    await assert.rejects(commitLocalPoseSnapshot(path, [{ id: 'pose_b' }], 'local:wrong'), PoseRevisionConflict);
    assert.equal(await readFile(path, 'utf8'), before);
    await writeFile(path, '{broken', 'utf8');
    await assert.rejects(readLocalPoseSnapshot(path));
    await assert.rejects(commitLocalPoseSnapshot(path, [{ id: 'pose_b' }], 'local:wrong'));
    assert.equal(await readFile(path, 'utf8'), '{broken');
  });
});

test('P05b an existing lock blocks writes and is not stolen or removed', async () => {
  await withCatalogue(async (path) => {
    const before = await readFile(path, 'utf8');
    await mkdir(path+'.write-lock');
    await assert.rejects(
      commitLocalPoseSnapshot(path, [{id:'pose_b'}], 'local:any', { attempts:2, pauseMs:2 }),
      /locked by another editor/,
    );
    assert.equal(await readFile(path, 'utf8'), before);
  });
});

test('P05b all four pose mutation routes use revision CAS and return conflict', async () => {
  const root = resolve(import.meta.dirname, '..');
  const paths = [
    'src/app/api/admin/yogi-knowledge/save/route.ts',
    'src/app/api/admin/yogi-knowledge/illustration/route.ts',
    'src/app/api/admin/yogi-knowledge/poses-relink/route.ts',
    'src/app/api/admin/yasuragi/practices/pose/route.ts',
  ];
  for (const name of paths) {
    const raw = await readFile(join(root, name), 'utf8');
    assert.match(raw, /store\.readPoseSnapshot\(\)/, name);
    assert.match(raw, /store\.savePoses\([^;]+, revision\)/s, name);
    assert.match(raw, /PoseRevisionConflict/, name);
    assert.match(raw, /409/, name);
  }
  const api = await readFile(join(root,'src/app/api/admin/yogi-knowledge/poses/route.ts'),'utf8');
  const ui = await readFile(join(root,'src/components/yogi/YogiKnowledgeAdmin.tsx'),'utf8');
  assert.match(api, /poses, revision/);
  assert.match(ui, /expectedRevision: poseRevision/);
});

test('P05b Blob commit uses immutable revisions and conditional ETag pointer writes', async () => {
  const root = resolve(import.meta.dirname, '..');
  const storage = await readFile(join(root, 'src/lib/yogiPoseRevisionStore.ts'), 'utf8');
  const facade = await readFile(join(root, 'src/lib/yogiKnowledgeStore.ts'), 'utf8');
  assert.match(storage, /const HEAD_PATH = "yogi\/pose-revisions\/head-v1\.json"/);
  assert.match(storage, /allowOverwrite: true, ifMatch: etag/);
  assert.match(storage, /allowOverwrite: false/);
  assert.match(storage, /putImmutableRevision\(items\)/);
  assert.match(storage, /readYogiPoseHead\(\)/);
  assert.match(facade, /commitYogiPoseBlobSnapshot\(items, expectedRevision, legacy\)/);
  assert.doesNotMatch(facade, /await writeCollection<Pose>\("poses", items\)/);
});

test('P05b mock Blob CAS race only publishes one immutable snapshot', async () => {
  let etag = 'etag-0';
  let live = 'original';
  const orphans = [];
  const adapter = (value) => commitPosePointerVersion({
    expectedRevision: 'head:etag-0',
    currentEtag: 'etag-0',
    prepareRevision: async () => {
      const revision = { value, id: orphans.length + 1 };
      orphans.push(revision);
      return revision;
    },
    compareAndSwapHead: async (revision, expected) => {
      if (etag !== expected) throw new PoseRevisionConflict();
      live = revision.value;
      etag = `etag-${revision.id}`;
      return etag;
    },
  });
  const attempts = await Promise.allSettled([adapter('alpha'), adapter('beta')]);
  assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((x) => x.status === 'rejected' && x.reason instanceof PoseRevisionConflict).length, 1);
  assert.ok(['alpha', 'beta'].includes(live));
  assert.equal(orphans.length, 2); // the loser can leave a recoverable, unreachable snapshot
});
