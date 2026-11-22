import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

function getBuilder() {
  const source = readFileSync('src/features/yasuragi/lib/practice-authoring-kit.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {})((id) => {
    if (id === './practice-import') return { YASURAGI_IMPORT_FORMAT: 'yasuragi.practice.v1' };
    if (id === './practice-authoring') return { YASURAGI_AUTHORING_FORMAT: 'yasuragi.authoring.v1' };
    throw new Error(id);
  }, module, module.exports);
  return module.exports.buildYasuragiAuthoringKit;
}

test('P04.1: a hiányzó képslot nem dönti meg a teljes Authoring Kit exportot', () => {
  const build = getBuilder();
  const kit = build([
    { id: 'pose_old', slug: 'old', name_hu: 'Régi póz', name_en: 'Old pose', status: 'draft', content_status: 'draft', validated: false },
    { id: 'pose_new', slug: 'new', name_hu: 'Új póz', name_en: 'New pose', status: 'active', content_status: 'verified', validated: true, mannequin_angled: { status: 'verified', asset_ref: 'private-image-ref' } },
  ], ['párna'], '2026-11-22T00:00:00.000Z');
  assert.equal(kit.poses.length, 2);
  const old = kit.poses.find((pose) => pose.poseId === 'pose_old');
  const fresh = kit.poses.find((pose) => pose.poseId === 'pose_new');
  assert.equal(old?.imageStatus, 'missing');
  assert.equal(old?.hasIllustration, false);
  assert.equal(fresh?.imageStatus, 'verified');
  assert.equal(fresh?.hasIllustration, true);
  assert.equal(JSON.stringify(kit).includes('private-image-ref'), false);
});

test('P04.1: a szerver szakaszonként külön, nem titkokat szivárogtató hibakódot ad', () => {
  const route = readFileSync('src/app/api/admin/yasuragi/authoring-kit/route.ts', 'utf8');
  for (const code of ['YAS_P04_LIBRARY_READ', 'YAS_P04_KIT_BUILD', 'YAS_P04_POSE_SCHEMA', 'YAS_P04_RESPONSE']) {
    assert.ok(route.includes(code), code);
  }
  assert.ok(route.includes('z.toJSONSchema(PoseSchema)'));
  assert.ok(!route.includes('unrepresentable: "any"'));
});

// Executed in the user's full Next.js repository, where Zod is installed.
test('P04.1: a valódi PoseSchema JSON Schema-ként exportálható', async (t) => {
  let z, PoseSchema;
  try {
    ({ z } = await import('zod'));
    ({ PoseSchema } = await import('../src/lib/yogiKnowledgeSchema.ts'));
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') { t.skip('Zod telepített node_modules nélkül nem érhető el ebben a csomagellenőrző környezetben'); return; }
    throw error;
  }
  const schema = z.toJSONSchema(PoseSchema);
  assert.equal(schema.type, 'object');
  assert.ok(schema.properties?.mannequin_angled);
  assert.ok(schema.properties?.duration);
  assert.ok(schema.required?.includes('id'));
});
