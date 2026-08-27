import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

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

/**
 * Password verification.
 *
 * The original design compared a bare, unsalted SHA-256 of the shared teacher
 * password. SHA-256 is a fast hash: a human-chosen school password is
 * recoverable from that digest offline in seconds with commodity hardware, and
 * the digest sits in an environment variable that anyone with dashboard access
 * or a logged env dump can read. Recovering it grants the `role: teacher`
 * custom claim. Server-side rate limiting only protects the online path.
 *
 * The verifier is now scrypt with a random per-deployment salt, serialised as
 *   scrypt$N=16384,r=8,p=1$<salt base64>$<hash base64>
 *
 * The legacy 64-char hex value is still accepted so that deploying this code
 * before rotating the environment variable cannot lock every teacher out.
 * Callers should surface `verifier.legacy` so the operator knows to rotate.
 */
export const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64 });

export function buildScryptVerifier(password, salt = randomBytes(16)) {
  const { N, r, p, keylen } = SCRYPT_PARAMS;
  return scryptAsync(String(password), salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }).then(
    (derived) =>
      `scrypt$N=${N},r=${r},p=${p}$${salt.toString('base64')}$${derived.toString('base64')}`
  );
}

export function parsePasswordVerifier(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Teacher password verifier is not configured');

  if (raw.startsWith('scrypt$')) {
    const parts = raw.split('$');
    if (parts.length !== 4) throw new Error('Malformed scrypt verifier');
    const params = {};
    for (const pair of parts[1].split(',')) {
      const [k, v] = pair.split('=');
      params[k] = Number(v);
    }
    if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) {
      throw new Error('Malformed scrypt parameters');
    }
    const salt = Buffer.from(parts[2], 'base64');
    const hash = Buffer.from(parts[3], 'base64');
    if (!salt.length || !hash.length) throw new Error('Malformed scrypt verifier');
    return { kind: 'scrypt', legacy: false, N: params.N, r: params.r, p: params.p, salt, hash };
  }

  return {
    kind: 'sha256',
    legacy: true,
    hash: Buffer.from(normalizePasswordHash(raw), 'hex'),
  };
}

/** Constant-time verification against either verifier format. */
export async function verifyPassword(password, verifier) {
  if (verifier.kind === 'scrypt') {
    const derived = await scryptAsync(String(password), verifier.salt, verifier.hash.length, {
      N: verifier.N,
      r: verifier.r,
      p: verifier.p,
      maxmem: 64 * 1024 * 1024,
    });
    return derived.length === verifier.hash.length && timingSafeEqual(derived, verifier.hash);
  }

  const actual = hashPassword(password);
  return actual.length === verifier.hash.length && timingSafeEqual(actual, verifier.hash);
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
