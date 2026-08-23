import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_IP_ATTEMPTS = 25;
export const LOCKOUT_MS = 30 * 60 * 1000;

export function normalizePasswordHash(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('TEACHER_VERIFICATION_PASSWORD_SHA256 must be a 64-character SHA-256 hex value');
  }
  return normalized;
}

export function hashPassword(password) {
  return createHash('sha256').update(String(password), 'utf8').digest();
}

export function passwordMatches(password, expectedHashHex) {
  const actual = hashPassword(password);
  const expected = Buffer.from(normalizePasswordHash(expectedHashHex), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function toMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
}

export function activeLock(data, nowMs) {
  const lockedUntilMs = toMillis(data?.lockedUntil);
  return {
    locked: lockedUntilMs > nowMs,
    retryAfterSeconds: lockedUntilMs > nowMs ? Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000)) : 0,
  };
}

export function nextFailedAttempt(data, nowMs, maxAttempts = MAX_ATTEMPTS) {
  const previousStart = toMillis(data?.windowStartedAt);
  const inWindow = previousStart > 0 && nowMs - previousStart < ATTEMPT_WINDOW_MS;
  const attempts = (inWindow && Number.isInteger(data?.attempts) ? data.attempts : 0) + 1;
  const locked = attempts >= maxAttempts;

  return {
    attempts,
    attemptsRemaining: Math.max(0, maxAttempts - attempts),
    windowStartedAtMs: inWindow ? previousStart : nowMs,
    lockedUntilMs: locked ? nowMs + LOCKOUT_MS : 0,
    retryAfterSeconds: locked ? Math.ceil(LOCKOUT_MS / 1000) : 0,
  };
}

export function rateLimitDocumentId(kind, value, secret) {
  const digest = createHmac('sha256', secret).update(`${kind}:${value}`, 'utf8').digest('hex');
  return `${kind}_${digest.slice(0, 48)}`;
}

export function clientIpFromHeaders(headers = {}) {
  const forwarded = headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
  const direct = Array.isArray(headers['x-real-ip']) ? headers['x-real-ip'][0] : headers['x-real-ip'];
  const candidate = String(first || direct || '').trim();
  return candidate && candidate.length <= 128 ? candidate : '';
}
