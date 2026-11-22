/** P04 pure publication gate + kit contract smoke tests. No storage writes and no dependencies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getProjectReview } from '../src/features/yasuragi/lib/practice-review.ts';
import { requiredPublicationPoses, evaluatePublicationGate, attestationsComplete, reviewReceiptIsCurrent } from '../src/features/yasuragi/lib/practice-publication.ts';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
import vm from 'node:vm';

const node = (id, pool, nextId) => ({ id, type: 'segment', posePool: pool, defaultPoseId: pool[0], nextNodeId: nextId, startGlobalSec: 0, durationSec: 120 });
const practice = { practiceId: 'p_test', version: '1.0', startNodeId: 'start', endNodeId: 'END', nodes: [
  node('start', ['pose_a'], 'choose'),
  { id: 'choose', type: 'decision', options: [
    { id: 'default', imagePoseId: 'pose_a', nextNodeId: 'live' },
    { id: 'hidden', imagePoseId: 'pose_blocked', nextNodeId: 'hidden', availability: 'blocked_missing_library' },
  ] },
  node('live', ['pose_b'], 'END'),
  { ...node('hidden', ['pose_blocked'], 'END'), availability: 'blocked_missing_library' },
] };
const livePose = (id, overrides = {}) => ({ id, slug:id, name_hu:id, status:'active', content_status:'verified', validated:true,
  mannequin_angled:{ status:'verified', asset_ref:`/file-${id}.png` }, ...overrides });
const sourceReport = { ok:true, errors:[], availableRouteCount:1, previewReady:true };
function gate(poses, report = sourceReport) {
  return evaluatePublicationGate(practice, report, getProjectReview(practice, [{poseId:'orphan', record:{name_hu:'unused'}}], poses));
}

test('only reachable unblocked pool and branch-image IDs require approval', () => {
  assert.deepEqual(requiredPublicationPoses(practice), ['pose_a','pose_b']);
});
test('strict gate is eligible only when the live poses have all editorial, image and expert flags', () => {
  const good=gate([livePose('pose_a'),livePose('pose_b')]);
  assert.equal(good.eligible,true);
  assert.equal(good.requiredPoseCount,2);
  assert.equal(good.blockers.length,0);
});
test('pose draft, missing image, and missing pose are blockers, not mere warnings', () => {
  const bad=gate([livePose('pose_a', {validated:false})]);
  assert.equal(bad.eligible,false);
  assert.deepEqual(bad.blockers.map((b)=>b.code),['POSE_REVIEW','POSE_MISSING']);
});
test('topology/preview failure cannot pass even when all poses are approved', () => {
  const bad=gate([livePose('pose_a'),livePose('pose_b')],{ok:false,errors:[{path:'nodes',code:'BAD',message:'bad'}],availableRouteCount:0,previewReady:false});
  assert.equal(bad.eligible,false);
  assert.ok(bad.blockers.some((b)=>b.code==='STRUCTURE'));
  assert.ok(bad.blockers.some((b)=>b.code==='PLAYBACK'));
});
test('attestations require three explicit boolean true values', () => {
  assert.equal(attestationsComplete({scriptReviewed:true,movementReviewed:true,previewChecked:true}),true);
  assert.equal(attestationsComplete({scriptReviewed:true,movementReviewed:true,previewChecked:'true'}),false);
});
test('approval is stale on practice/library change or when the gate no longer passes', () => {
  const good=gate([livePose('pose_a'),livePose('pose_b')]);
  const receipt={scriptSha256:'aa',librarySha256:'bb'};
  assert.equal(reviewReceiptIsCurrent(good,receipt,'aa','bb'),true);
  assert.equal(reviewReceiptIsCurrent(good,receipt,'new','bb'),false);
  assert.equal(reviewReceiptIsCurrent(good,receipt,'aa','changed'),false);
  assert.equal(reviewReceiptIsCurrent(gate([livePose('pose_a')]),receipt,'aa','bb'),false);
});
test('authoring kit exports catalogue IDs/equipment/schema rules but no private drafts or image links', () => {
  const source=readFileSync('src/features/yasuragi/lib/practice-authoring-kit.ts','utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{} )((id)=> {
    if(id==='./practice-import')return {YASURAGI_IMPORT_FORMAT:'yasuragi.practice.v1'};
    if(id==='./practice-authoring')return {YASURAGI_AUTHORING_FORMAT:'yasuragi.authoring.v1'};
    throw Error(id);
  },module,module.exports);
  const result=module.exports.buildYasuragiAuthoringKit([livePose('pose_a')],['párna'],'2026-11-22T00:00:00Z');
  assert.equal(result.format,'yasuragi.authoring-kit.v1');
  assert.equal(result.poses[0].poseId,'pose_a');
  assert.equal(result.poses[0].hasIllustration,true);
  assert.deepEqual([...result.equipment],['párna']);
  assert.equal(JSON.stringify(result).includes('/file-pose_a.png'),false);
  assert.equal(JSON.stringify(result).includes('private'),false);
});

test('the current Földön dolgozás sample is not publication-ready merely because import and previews work', () => {
  const authored = JSON.parse(readFileSync('data/yasuragi/foldon-dolgozas-p02-unified-authoring-sample.json', 'utf8'));
  const live = JSON.parse(readFileSync('data/yogi/poses.json', 'utf8'));
  const report = {ok:true,errors:[],availableRouteCount:4,previewReady:true};
  const result = evaluatePublicationGate(authored.practice, report, getProjectReview(authored.practice, authored.poseProposals, live));
  assert.equal(result.eligible,false);
  assert.ok(result.blockers.some((b)=>b.code==='POSE_REVIEW' || b.code==='POSE_MISSING'));
});
