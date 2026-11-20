// Node 22+ static TypeScript stripping (no third-party runtime test dependency).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminSession,
  getAdminSecret,
  isSameOriginMutation,
  verifyAdminSession,
  SHORT_SESSION_SECONDS,
  LONG_SESSION_SECONDS,
} from '../../src/lib/adminSession.ts';

const secret = 'example-test-key-with-no-production-access';
const now = 1795150800000;

test('missing admin configuration always fails closed', () => {
  const previousKey = process.env.ADMIN_KEY;
  const previousPassword = process.env.ADMIN_PASSWORD;
  try {
    delete process.env.ADMIN_KEY;
    delete process.env.ADMIN_PASSWORD;
    assert.equal(getAdminSecret(), null);
    assert.equal(verifyAdminSession(undefined, null, now), false);
  } finally {
    if (previousKey === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = previousKey;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test('session token is signed, does not expose the admin secret and expires', () => {
  for (const [remember, lifespan] of [[false, SHORT_SESSION_SECONDS], [true, LONG_SESSION_SECONDS]]) {
    const token = createAdminSession(secret, remember, now);
    assert.ok(!token.includes(secret));
    assert.equal(verifyAdminSession(token, secret, now), true);
    assert.equal(verifyAdminSession(token, secret, now + (lifespan - 1) * 1000), true);
    assert.equal(verifyAdminSession(token, secret, now + lifespan * 1000), false);
    assert.equal(verifyAdminSession(token, 'other-key', now), false);
    assert.equal(verifyAdminSession(token.replace(/.$/, '0'), secret, now), false);
    assert.equal(verifyAdminSession(secret, secret, now), false);
    assert.equal(verifyAdminSession('admin_key=' + secret, secret, now), false);
  }
});

test('unsafe mutations require an exact matching Origin', () => {
  const make = (origin) => new Request('https://kincstarto.example/api/admin/test', {
    method: 'POST',
    headers: origin === null ? {} : { Origin: origin },
  });
  assert.equal(isSameOriginMutation(make('https://kincstarto.example')), true);
  assert.equal(isSameOriginMutation(make('https://attacker.example')), false);
  assert.equal(isSameOriginMutation(make('https://kincstarto.example.evil.test')), false);
  assert.equal(isSameOriginMutation(make('null')), false);
  assert.equal(isSameOriginMutation(make(null)), false);
});
