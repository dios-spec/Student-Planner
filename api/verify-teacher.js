import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { adminApp } from './_lib/firebaseAdmin.js';
import {
  MAX_ATTEMPTS,
  MAX_IP_ATTEMPTS,
  activeLock,
  clientIpFromHeaders,
  nextFailedAttempt,
  normalizePasswordHash,
  passwordMatches,
  rateLimitDocumentId,
} from './_lib/teacherVerification.js';

const MAX_BODY_BYTES = 4096;

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function bodyFromRequest(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body || {};
}

async function syncTeacherProfile(db, uid) {
  const ref = db.collection('users').doc(uid);
  const snapshot = await ref.get();
  const current = snapshot.exists ? snapshot.data() || {} : {};
  const patch = {
    role: 'teacher',
    teacherRoleVersion: 1,
    ...(current.teacherVerifiedAt ? {} : { teacherVerifiedAt: FieldValue.serverTimestamp() }),
  };

  if (!snapshot.exists) {
    Object.assign(patch, {
      displayName: 'Teacher',
      bio: '',
      emoji: '📚',
      createdAt: FieldValue.serverTimestamp(),
      lastSeen: FieldValue.serverTimestamp(),
    });
  }

  await ref.set(patch, { merge: true });
}

async function promoteToTeacher(auth, db, uid) {
  const userRecord = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, {
    ...userRecord.customClaims,
    role: 'teacher',
  });
  await syncTeacherProfile(db, uid);
}

async function applyRateLimit(db, entries, correctPassword) {
  const nowMs = Date.now();

  return db.runTransaction(async (transaction) => {
    const snapshots = [];
    for (const entry of entries) snapshots.push(await transaction.get(entry.ref));

    let retryAfterSeconds = 0;
    for (const snapshot of snapshots) {
      const lock = activeLock(snapshot.exists ? snapshot.data() : {}, nowMs);
      retryAfterSeconds = Math.max(retryAfterSeconds, lock.retryAfterSeconds);
    }

    if (retryAfterSeconds > 0) {
      return { allowed: false, rateLimited: true, retryAfterSeconds, attemptsRemaining: 0 };
    }

    if (correctPassword) {
      return { allowed: true, rateLimited: false, retryAfterSeconds: 0, attemptsRemaining: null };
    }

    let attemptsRemaining = Number.POSITIVE_INFINITY;
    for (let index = 0; index < entries.length; index += 1) {
      const snapshot = snapshots[index];
      const next = nextFailedAttempt(
        snapshot.exists ? snapshot.data() : {},
        nowMs,
        entries[index].maxAttempts
      );
      attemptsRemaining = Math.min(attemptsRemaining, next.attemptsRemaining);
      retryAfterSeconds = Math.max(retryAfterSeconds, next.retryAfterSeconds);

      transaction.set(entries[index].ref, {
        attempts: next.attempts,
        windowStartedAt: Timestamp.fromMillis(next.windowStartedAtMs),
        lockedUntil: next.lockedUntilMs ? Timestamp.fromMillis(next.lockedUntilMs) : null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return {
      allowed: false,
      rateLimited: retryAfterSeconds > 0,
      retryAfterSeconds,
      attemptsRemaining: Number.isFinite(attemptsRemaining) ? attemptsRemaining : 0,
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed', code: 'method_not_allowed' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return send(res, 413, { error: 'Request too large', code: 'invalid_request' });
  }

  try {
    adminApp();
    const auth = getAuth();
    const db = getFirestore();
    const authHeader = String(req.headers.authorization || '');

    if (!authHeader.startsWith('Bearer ')) {
      return send(res, 401, { error: 'Authentication required', code: 'invalid_token' });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(authHeader.slice(7), true);
    } catch {
      return send(res, 401, { error: 'Invalid or expired session', code: 'invalid_token' });
    }

    // A signed Firebase claim is authoritative. This path also repairs an older
    // profile document without asking an already-verified teacher for the password.
    if (decoded.role === 'teacher') {
      await syncTeacherProfile(db, decoded.uid);
      return send(res, 200, { verified: true, role: 'teacher', alreadyVerified: true });
    }

    let body;
    try {
      body = bodyFromRequest(req);
    } catch {
      return send(res, 400, { error: 'Invalid JSON body', code: 'invalid_request' });
    }

    const password = body.password;
    if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
      return send(res, 400, { error: 'Teacher password required', code: 'invalid_request' });
    }

    let expectedHash;
    try {
      expectedHash = normalizePasswordHash(process.env.TEACHER_VERIFICATION_PASSWORD_SHA256);
    } catch {
      console.error('[TEACHER VERIFY] Password hash is not configured');
      return send(res, 503, { error: 'Teacher verification is not configured', code: 'not_configured' });
    }

    const ip = clientIpFromHeaders(req.headers);
    const entries = [
      {
        ref: db.collection('teacherVerificationAttempts').doc(
          rateLimitDocumentId('uid', decoded.uid, expectedHash)
        ),
        maxAttempts: MAX_ATTEMPTS,
      },
    ];
    if (ip) {
      entries.push({
        ref: db.collection('teacherVerificationAttempts').doc(
          rateLimitDocumentId('ip', ip, expectedHash)
        ),
        maxAttempts: MAX_IP_ATTEMPTS,
      });
    }

    const correctPassword = passwordMatches(password, expectedHash);
    const gate = await applyRateLimit(db, entries, correctPassword);

    if (gate.rateLimited) {
      res.setHeader('Retry-After', String(gate.retryAfterSeconds));
      return send(res, 429, {
        error: 'Teacher verification temporarily locked',
        code: 'rate_limited',
        retryAfterSeconds: gate.retryAfterSeconds,
      });
    }

    if (!gate.allowed) {
      return send(res, 403, {
        error: 'Teacher verification failed',
        code: 'invalid_password',
        attemptsRemaining: gate.attemptsRemaining,
      });
    }

    await promoteToTeacher(auth, db, decoded.uid);

    const cleanup = db.batch();
    entries.forEach(({ ref }) => cleanup.delete(ref));
    await cleanup.commit().catch(() => {});

    return send(res, 200, { verified: true, role: 'teacher' });
  } catch (error) {
    console.error('[TEACHER VERIFY]', error instanceof Error ? error.message : 'Unknown error');
    return send(res, 500, { error: 'Teacher verification failed', code: 'server_error' });
  }
}
