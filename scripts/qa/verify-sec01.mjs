// Run against the local Next.js dev server, without an authenticated cookie.
// Usage: node scripts/qa/verify-sec01.mjs http://localhost:3000
import assert from 'node:assert/strict';

const root = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
let checks = 0;

async function check(path, expected, options = {}) {
  const response = await fetch(root + path, { redirect: 'manual', cache: 'no-store', ...options });
  const ok = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${options.method || 'GET'} ${path} => ${response.status} (expected ${expected})`);
  assert.ok(ok, `Unexpected status for ${path}`);
  checks++;
  return response;
}

for (const path of [
  '/api/admin/yogi-knowledge/poses',
  '/api/activity-logs?month=2026-11',
  '/api/yogi-knowledge/poses',
  '/api/yogi-knowledge/anatomy',
  '/api/yogi-knowledge/knowledge-cards',
  '/api/yogi-knowledge/image-proxy?url=https%3A%2F%2Fpublic.blob.vercel-storage.com%2Ftest.png',
  '/api/yogis-choice/yoga-templates',
  '/api/yogis-choice/yoga-video-meta',
  '/api/yoga-templates',
  '/api/strength-progress',
  '/api/debug',
]) {
  await check(path, 401);
}
await check('/yogis-choice', 404);
await check('/yogis-choice/poses/test', 404);
const admin = await check('/admin/yoga', [302, 303, 307, 308]);
assert.equal(new URL(admin.headers.get('location'), root).pathname, '/login');
await check('/admin', [302, 303, 307, 308]);
await check('/api/login', 403, {
  method: 'POST', headers: { 'Origin': 'https://attacker.example', 'Content-Type': 'application/json' },
  body: '{}',
});
await check('/api/activity-logs', 401, {
  method: 'POST', headers: { 'Origin': root, 'Content-Type': 'application/json' }, body: '{}',
});
await check('/yogis-choice', 404, { headers: { 'Cookie': 'admin_key=old-raw-secret' } });
await check('/library', 200);
await check('/meditations', 200);
console.log(`SEC-01 anonymous route QA: ${checks} checks passed.`);
