import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const filename = new URL('../../src/app/api/admin/spirit/private-preflight/route.ts', import.meta.url);
const source = await readFile(filename, 'utf8');

test('runtime preflight verifies admin authorization before credential access', () => {
  const guard = source.indexOf('await requireAdmin()');
  const credentials = source.indexOf('const credentials = resolveCredentials()');
  assert.ok(guard >= 0 && credentials > guard);
  assert.match(source, /if \(rejected\) return rejected/);
});
test('only an authenticated GET exists and no mutations are imported', () => {
  assert.match(source, /export async function GET\(/);
  assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)\(/);
  assert.doesNotMatch(source, /\bput\s*\(|\bdel\s*\(|\bcopy\s*\(/);
  assert.match(source, /import \{ get, head, list \} from "@vercel\/blob"/);
  assert.match(source, /\bpreflight\(/);
});
test('response cannot include raw errors, token, blob URLs or personal fields', () => {
  assert.match(source, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(source, /console\.(log|error)/);
  assert.doesNotMatch(source, /error\.message|credentials\.publicToken\)|credentials\.privateToken\)/);
  assert.match(source, /PREFLIGHT_STOPPED/);
  assert.match(source, /"NO_WRITES"/);
});
test('runtime must not use a locally pulled Secret placeholder', () => {
  assert.match(source, /\[SENSITIVE\]/);
  assert.match(source, /process\.env\.BLOB_READ_WRITE_TOKEN/);
  assert.match(source, /resolveShioriPrivateBlobToken\(\)/);
});
