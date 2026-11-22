import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';

// The repository ZIP intentionally contains no node_modules. This focused harness
// tests import routing and graph logic; the real Zod schema is checked in the local build.
const require = createRequire(import.meta.url);
const ts = require('typescript');
function loadTs(path, mocks) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const localRequire = (name) => { if (name in mocks) return mocks[name]; throw Error(`Unexpected import: ${name}`); };
  const wrapper = vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {}, { filename: path });
  wrapper(localRequire, mod, mod.exports);
  return mod.exports;
}
const root = 'src/features/yasuragi/lib/';
const base = loadTs(root + 'practice-import.ts', {});
const engine = loadTs(root + 'practice-engine.ts', {});
const fakeSchema = { safeParse: (value) => value && typeof value === 'object' && value.id && value.category && value.duration && value.mannequin_angled
  ? { success:true, data:value } : { success:false, error:{issues:[{path:['id']}]}} };
const unified = loadTs(root + 'practice-authoring.ts', { './practice-import':base, './practice-engine':engine, '@/lib/yogiKnowledgeSchema': { PoseSchema:fakeSchema } });
const sample = JSON.parse(readFileSync('data/yasuragi/foldon-dolgozas-p02-unified-authoring-sample.json', 'utf8'));
const plain = JSON.parse(readFileSync('data/yasuragi/foldon-dolgozas-p02-import-sample.json', 'utf8'));
const live = JSON.parse(readFileSync('data/yogi/poses.json', 'utf8'));
const poses = Object.fromEntries(live.filter(p => p.status === 'active').map(p => [p.id, {
  id:p.id, name:p.name_hu, imageUrl:p.mannequin_angled?.asset_ref ?? '', validated:p.validated,
}]));
const props = ['fal','szék','takaró','jóga tégla','heveder','párna','habhenger','jógaszőnyeg','törölköző','ék','csuklótámasz'];
const inspect = (input) => unified.inspectAuthoringImport(input,poses,props);
const clone = (value) => JSON.parse(JSON.stringify(value));

test('import an ordinary practice without silently reinterpreting the format', () => {
  const result=inspect(plain);
  assert.equal(result.report.mode,'practice');
  assert.equal(result.report.ok,true,JSON.stringify(result.report.errors));
  assert.equal(result.authoring,null);
});
test('unified authoring package retains three draft pose proposals without adding library poses', () => {
  const before=Object.keys(poses).length;
  const result=inspect(sample);
  assert.equal(result.report.mode,'authoring');
  assert.equal(result.report.ok,true,JSON.stringify(result.report.errors));
  assert.equal(result.report.poseProposalCount,3);
  assert.equal(result.authoring.poseProposals.length,3);
  assert.equal(Object.keys(poses).length,before);
  assert.ok(result.report.dependencies.some(x => x.poseId==='pose_supported_side_sit' && x.state==='proposal_pending'));
});
test('a missing default library pose may be saved as a project but blocks playback', () => {
  const changed=clone(sample);
  const first=changed.practice.nodes.find(n=>n.type==='segment' && n.id==='P0');
  first.posePool=['pose_supported_floor_sit'];
  first.defaultPoseId='pose_supported_floor_sit';
  first.poseVariants.pose_supported_floor_sit=first.poseVariants[Object.keys(first.poseVariants)[0]];
  const result=inspect(changed);
  assert.equal(result.report.ok,true,JSON.stringify(result.report.errors));
  assert.equal(result.report.previewReady,false);
  assert.ok(result.report.dependencies.some(x=>x.poseId==='pose_supported_floor_sit' && x.state==='proposal_pending'));
});
test('P05d: missing illustrated default branch preserves draft but disables preview', () => {
  const changed = clone(sample);
  const decision = changed.practice.nodes.find(n => n.type === 'decision' && n.id === 'D1');
  const defaultOption = decision.options.find(o => o.id === decision.defaultOptionId);
  defaultOption.imagePoseId = 'pose_missing_default_image';
  const result = inspect(changed);
  assert.equal(result.report.ok, true, JSON.stringify(result.report.errors));
  assert.equal(result.report.previewReady, false);
  assert.ok(result.report.warnings.some(issue => issue.code === 'DEFAULT_UNAVAILABLE'));
});

test('an unsafe active/published pose proposal is rejected', () => {
  const changed=clone(sample);
  changed.poseProposals[0].record.status='active';
  const result=inspect(changed);
  assert.equal(result.report.ok,false);
  assert.ok(result.report.errors.some(x=>x.code==='PROPOSAL_STATE'));
});
test('invalid route time remains a hard structural error with virtual pose dependencies', () => {
  const changed=clone(sample);
  changed.practice.nodes.find(n=>n.id==='P3').startGlobalSec=333;
  const result=inspect(changed);
  assert.equal(result.report.ok,false);
  assert.ok(result.report.errors.some(x=>x.code==='ROUTE_TIME'));
});
test('duplicate proposed pose IDs rejected, no silent overwrite', () => {
  const changed=clone(sample);
  changed.poseProposals.push(clone(changed.poseProposals[0]));
  const result=inspect(changed);
  assert.equal(result.report.ok,false);
  assert.ok(result.report.errors.some(x=>x.code==='PROPOSAL_DUPLICATE'));
});
console.log('Yasuragi P02: offline structural harness complete. Real Zod/API/build pending local repo verification.');
