import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/api/admin/yasuragi/authoring-kit/route.ts', 'utf8');

test('P04.2: PoseSchema overload gets input-specific inference rather than registry overload', () => {
  assert.match(route, /function exportPoseSchema\(\)\s*\{\s*return z\.toJSONSchema\(PoseSchema\);\s*\}/);
  assert.match(route, /let poseSchema: ReturnType<typeof exportPoseSchema>;/);
  assert.match(route, /poseSchema = exportPoseSchema\(\);/);
  assert.doesNotMatch(route, /ReturnType<typeof z\.toJSONSchema>/);
});

test('P04.2: export still uses real PoseSchema, distinct diagnostic codes and no unsafe fallback', () => {
  for (const code of ['YAS_P04_LIBRARY_READ', 'YAS_P04_KIT_BUILD', 'YAS_P04_POSE_SCHEMA', 'YAS_P04_RESPONSE']) {
    assert.ok(route.includes(code), code);
  }
  assert.ok(route.includes('NextResponse.json({ ...kit, poseSchema }'));
  assert.ok(route.includes('requireAdmin()'));
  assert.ok(!route.includes('unrepresentable: "any"'));
});
