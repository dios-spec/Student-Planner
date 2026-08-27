import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { adminApp } from './_lib/firebaseAdmin.js';
import {
  DELETION_PLAN,
  anonymisedProfile,
  chunk,
  nextGroupMembership,
  redactedMessage,
} from './_lib/accountDeletion.js';

const AUTH_ERROR_CODES = new Set([
  'auth/id-token-expired', 'auth/id-token-revoked', 'auth/session-cookie-expired',
  'auth/session-cookie-revoked', 'auth/argument-error', 'auth/invalid-id-token',
  'auth/user-disabled', 'auth/user-not-found',
]);

/** Documents pulled per query page. */
const PAGE = 400;

async function deleteQuery(db, collection, field, uid) {
  let removed = 0;
  for (;;) {
    const snap = await db.collection(collection).where(field, '==', uid).limit(PAGE).get();
    if (snap.empty) return removed;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    removed += snap.size;

    if (snap.size < PAGE) return removed;
  }
}

async function redactQuery(db, collection, field, uid) {
  const patch = redactedMessage(FieldValue.delete());
  let touched = 0;
  let cursor = null;

  for (;;) {
    let q = db.collection(collection).where(field, '==', uid).limit(PAGE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) return touched;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.set(d.ref, patch, { merge: true }));
    await batch.commit();
    touched += snap.size;
    cursor = snap.docs[snap.docs.length - 1];

    if (snap.size < PAGE) return touched;
  }
}

/**
 * Conversations need care: a DM cannot simply lose a member (the schema and the
 * rules both assume exactly two), and a group must not be left without an
 * admin. Messages are redacted rather than deleted so the other person's thread
 * does not develop holes.
 */
async function handleConversations(db, uid) {
  const snap = await db.collection('conversations').where('memberIds', 'array-contains', uid).get();
  let conversations = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};

    await redactQuery(db, `conversations/${doc.id}/messages`, 'senderId', uid);

    if (data.type === 'group') {
      const next = nextGroupMembership(data.memberIds, data.adminIds, uid);
      if (next.empty) {
        await doc.ref.delete();
      } else {
        // update(), NOT set({merge:true}): with set+merge a key like
        // "members.<uid>" is stored as a LITERAL field name containing a dot
        // rather than being resolved as a nested path, so the member entry
        // would survive and a junk field would be added beside it.
        await doc.ref.update({
          memberIds: next.memberIds,
          adminIds: next.adminIds,
          [`members.${uid}`]: FieldValue.delete(),
          [`unread.${uid}`]: FieldValue.delete(),
          [`lastReadAt.${uid}`]: FieldValue.delete(),
          [`typing.${uid}`]: FieldValue.delete(),
        });
      }
    } else {
      // DM: keep the two-member shape, anonymise the denormalised copy.
      // update() for the same nested-path reason as above.
      await doc.ref.update({
        [`members.${uid}`]: { name: 'Deleted user' },
        [`unread.${uid}`]: FieldValue.delete(),
        [`typing.${uid}`]: FieldValue.delete(),
      });
    }

    conversations += 1;
  }

  return conversations;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'invalid_token' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body', code: 'invalid_request' });
  }

  // A deliberate, explicit intent signal. The UI makes the user type this.
  if (body.confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Confirmation missing', code: 'not_confirmed' });
  }

  let uid;
  let db;

  try {
    const app = adminApp();
    const auth = getAuth(app);
    db = getFirestore(app);

    // checkRevoked: a stolen or revoked token must never be able to destroy an
    // account. The identity is taken ONLY from the verified token -- there is
    // no uid in the request body, so nobody can delete anyone else.
    let decoded;
    try {
      decoded = await auth.verifyIdToken(authHeader.slice(7), true);
    } catch (error) {
      const code = error && typeof error === 'object' ? String(error.code || '') : '';
      if (AUTH_ERROR_CODES.has(code)) {
        return res.status(401).json({ error: 'Invalid or expired session', code: 'invalid_token' });
      }
      throw error;
    }

    uid = decoded.uid;
    const progress = db.collection('accountDeletions').doc(uid);

    // A progress record, so a half-finished deletion is never silent.
    await progress.set(
      { uid, status: 'running', startedAt: FieldValue.serverTimestamp(), steps: {} },
      { merge: true }
    );

    const steps = {};

    for (const rule of DELETION_PLAN) {
      if (rule.match === 'docId') {
        await db.collection(rule.collection).doc(uid).delete();
        steps[rule.collection] = 'deleted';
        continue;
      }

      const key = `${rule.collection}.${rule.match}`;
      steps[key] = rule.mode === 'redact'
        ? await redactQuery(db, rule.collection, rule.match, uid)
        : await deleteQuery(db, rule.collection, rule.match, uid);
    }

    steps.conversations = await handleConversations(db, uid);

    // The profile document is anonymised rather than deleted, so merit records,
    // planner items and other people's message history keep a resolvable
    // reference instead of rendering as blanks.
    await db.collection('users').doc(uid).set(
      anonymisedProfile(FieldValue.serverTimestamp()),
      { merge: true }
    );
    steps.profile = 'anonymised';

    // Identity last. Everything above is retryable while the user can still
    // authenticate; once this succeeds there is nothing left to retry.
    await auth.deleteUser(uid);
    steps.auth = 'deleted';

    await progress.set(
      { status: 'complete', finishedAt: FieldValue.serverTimestamp(), steps },
      { merge: true }
    );

    return res.status(200).json({ deleted: true, steps });
  } catch (error) {
    console.error('[DELETE ACCOUNT]', error instanceof Error ? error.message : 'Unknown error');

    if (uid && db) {
      await db.collection('accountDeletions').doc(uid).set(
        {
          status: 'failed',
          failedAt: FieldValue.serverTimestamp(),
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
        { merge: true }
      ).catch(() => {});
    }

    // Retryable: nothing here leaves the account usable-but-broken without a
    // record, and re-running the endpoint resumes from wherever it stopped.
    return res.status(500).json({ error: 'Account deletion did not finish', code: 'server_error' });
  }
}
