/** Pure, no-dependency P03 review smoke tests. Use: node --experimental-strip-types --test scripts/test-yasuragi-p03.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectReview, assessNewPoseDraft } from '../src/features/yasuragi/lib/practice-review.ts';
const script = { nodes: [
  { type: 'segment', posePool: ['p_one','p_two'], defaultPoseId: 'p_one' },
  { type: 'decision', options: [{ imagePoseId: 'p_two', requiresPoseIds: ['p_three'] }] },
] };
const proposals = [ { poseId: 'p_three', record: { name_hu: 'Oldalülés' } }, { poseId: 'p_four', record: { name_hu: 'Nem használt új póz' } } ];
const pose = (id, overrides = {}) => ({ id, name_hu: id, slug: id, status: 'active', content_status: 'published', validated: true,
  mannequin_angled: { status: 'verified', asset_ref: '/image.png' }, ...overrides });
test('deduplicates all references and retains orphan proposals', () => {
  const report = getProjectReview(script, proposals, [pose('p_one')]);
  const two = report.items.find((entry) => entry.poseId === 'p_two');
  const three = report.items.find((entry) => entry.poseId === 'p_three');
  assert.equal(two.referenceCount, 2);
  assert.equal(two.libraryStatus, 'missing');
  assert.equal(three.hasProposal, true);
  assert.equal(three.referenceCount, 1);
  assert.equal(report.items.find((entry) => entry.poseId === 'p_four').referenceCount, 0);
});
test('review gate requires explicit content, image and expert validation, not just a file', () => {
  const report = getProjectReview(script, proposals, [pose('p_one'), pose('p_two', { validated: false }),
    pose('p_three', { status: 'draft', content_status: 'draft', mannequin_angled: { status: 'generated', asset_ref: '/image.png' } })]);
  assert.equal(report.libraryReadyCount, 1);
  assert.equal(report.unapprovedCount, 2);
  assert.equal(report.items.find((entry) => entry.poseId === 'p_three').libraryReady, false);
  assert.equal(report.publicationGate, 'not_implemented');
});

test('create-only preflight blocks existing id, conflicting slug and publish-state proposals', () => {
  const clean = { id: 'p_five', slug: 'new_pose', status: 'draft', content_status: 'draft', validated: false,
    mannequin_angled: { status: 'missing', asset_ref: null } };
  const normalize = (value) => value.toLowerCase();
  assert.equal(assessNewPoseDraft('p_five', clean, [], normalize), 'ok');
  assert.equal(assessNewPoseDraft('p_five', clean, [{ id: 'p_five', slug: 'other' }], normalize), 'collision');
  assert.equal(assessNewPoseDraft('p_five', clean, [{ id: 'other', slug: 'NEW_POSE' }], normalize), 'collision');
  assert.equal(assessNewPoseDraft('p_five', { ...clean, validated: true }, [], normalize), 'unsafe_state');
  assert.equal(assessNewPoseDraft('p_five', { ...clean, mannequin_angled: { status: 'verified', asset_ref: '/image.png' } }, [], normalize), 'unsafe_state');
});
