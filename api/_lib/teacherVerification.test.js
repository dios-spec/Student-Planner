import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  MAX_IP_ATTEMPTS,
  activeLock,
  clientIpFromHeaders,
  nextFailedAttempt,
  normalizePasswordHash,
  passwordMatches,
  rateLimitDocumentId,
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
