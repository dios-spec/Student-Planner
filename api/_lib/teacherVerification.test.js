import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  MAX_IP_ATTEMPTS,
  activeLock,
  buildScryptVerifier,
  clientIpFromHeaders,
  nextFailedAttempt,
  normalizePasswordHash,
  parsePasswordVerifier,
  passwordMatches,
  rateLimitDocumentId,
  verifyPassword,
} from './teacherVerification.js';

test('passwords are checked against a SHA-256 hash', () => {
  const expected = createHash('sha256').update('correct horse', 'utf8').digest('hex');
  assert.equal(passwordMatches('correct horse', expected), true);
  assert.equal(passwordMatches('wrong horse', expected), false);
  assert.throws(() => normalizePasswordHash('not-a-hash'));
});

test('the fifth failed attempt creates a thirty-minute lock', () => {
  const now = 1_800_000_000_000;
  let state = {};

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const next = nextFailedAttempt(state, now + attempt * 1000);
    state = {
      attempts: next.attempts,
      windowStartedAt: next.windowStartedAtMs,
      lockedUntil: next.lockedUntilMs,
    };
  }

  const lock = activeLock(state, now + MAX_ATTEMPTS * 1000);
  assert.equal(lock.locked, true);
  assert.equal(state.lockedUntil, now + MAX_ATTEMPTS * 1000 + LOCKOUT_MS);
});

test('the shared IP limit is higher than the per-user limit', () => {
  const now = 1_800_000_000_000;
  const beforeLimit = nextFailedAttempt(
    { attempts: MAX_IP_ATTEMPTS - 2, windowStartedAt: now },
    now + 1000,
    MAX_IP_ATTEMPTS
  );
  assert.equal(beforeLimit.attemptsRemaining, 1);
  assert.equal(beforeLimit.lockedUntilMs, 0);

  const atLimit = nextFailedAttempt(
    { attempts: MAX_IP_ATTEMPTS - 1, windowStartedAt: now },
    now + 2000,
    MAX_IP_ATTEMPTS
  );
  assert.equal(atLimit.attemptsRemaining, 0);
  assert.ok(atLimit.lockedUntilMs > now);
});

test('rate-limit identifiers hide both uid and IP', () => {
  const uid = 'example-user-id';
  const id = rateLimitDocumentId('uid', uid, 'server-secret');
  assert.match(id, /^uid_[a-f0-9]{48}$/);
  assert.equal(id.includes(uid), false);
  assert.equal(id, rateLimitDocumentId('uid', uid, 'server-secret'));
  assert.notEqual(id, rateLimitDocumentId('ip', uid, 'server-secret'));
});

test('the first forwarded address is used for rate limiting', () => {
  assert.equal(clientIpFromHeaders({ 'x-forwarded-for': '203.0.113.4, 10.0.0.1' }), '203.0.113.4');
  assert.equal(clientIpFromHeaders({ 'x-real-ip': '203.0.113.8' }), '203.0.113.8');
});

test('the scrypt verifier round-trips and rejects a wrong password', async () => {
  const verifier = await buildScryptVerifier('correct horse battery staple');
  assert.match(verifier, /^scrypt\$N=\d+,r=\d+,p=\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);

  const parsed = parsePasswordVerifier(verifier);
  assert.equal(parsed.kind, 'scrypt');
  assert.equal(parsed.legacy, false);
  assert.equal(await verifyPassword('correct horse battery staple', parsed), true);
  assert.equal(await verifyPassword('correct horse battery stapl', parsed), false);
});

test('the same password produces a different verifier every time (it is salted)', async () => {
  const a = await buildScryptVerifier('same password');
  const b = await buildScryptVerifier('same password');
  assert.notEqual(a, b, 'two deployments must not share a digest');
  // ...and both still verify.
  assert.equal(await verifyPassword('same password', parsePasswordVerifier(a)), true);
  assert.equal(await verifyPassword('same password', parsePasswordVerifier(b)), true);
});

test('the deprecated SHA-256 value still verifies, and is flagged as legacy', async () => {
  const legacyValue = createHash('sha256').update('old school password', 'utf8').digest('hex');
  const parsed = parsePasswordVerifier(legacyValue);
  assert.equal(parsed.kind, 'sha256');
  assert.equal(parsed.legacy, true, 'operators must be told to rotate');
  assert.equal(await verifyPassword('old school password', parsed), true);
  assert.equal(await verifyPassword('nope', parsed), false);
});

test('malformed or missing verifiers are rejected rather than silently accepted', () => {
  assert.throws(() => parsePasswordVerifier(''));
  assert.throws(() => parsePasswordVerifier('   '));
  assert.throws(() => parsePasswordVerifier('scrypt$N=x,r=8,p=1$c2FsdA==$aGFzaA=='));
  assert.throws(() => parsePasswordVerifier('scrypt$N=16384,r=8,p=1$$'));
  assert.throws(() => parsePasswordVerifier('scrypt$N=16384,r=8,p=1$c2FsdA=='));
  assert.throws(() => parsePasswordVerifier('not-a-hash'));
});
