import { doc, onSnapshot, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from './config';
import type { Conversation, PinnedMessage } from '../types';
import { applyPin, applyUnpin, type PinOutcome } from '../utils/pinList';

const classPinsRef = doc(db, 'appMeta', 'classChatPins');


// ---- Class chat: single shared pinned list ----

export function watchClassPins(cb: (pinned: PinnedMessage[]) => void) {
  return onSnapshot(classPinsRef, (snap) => {
    cb(snap.exists() ? ((snap.data().pinned as PinnedMessage[]) || []) : []);
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[PINS] watchClassPins failed:', err);
      cb([]);
    }
  );
}

/**
 * All four functions below were read-modify-write races.
 *
 * pinClassMessage/unpinClassMessage did getDoc() then wrote the whole array
 * back with merge -- and Firestore merge REPLACES an array rather than merging
 * it, so two students pinning different messages within the round-trip window
 * silently lost one of the pins. The DM variants were worse: they never read at
 * all, they trusted the `pinned` array on whatever Conversation object the
 * component happened to be holding, so any stale render clobbered the list.
 *
 * runTransaction re-reads and retries on conflict, which is the only safe way
 * to mutate a shared array from multiple clients.
 */

export async function pinClassMessage(entry: Omit<PinnedMessage, 'pinnedAt'>): Promise<PinOutcome> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(classPinsRef);
    const current: PinnedMessage[] = snap.exists() ? (snap.data().pinned as PinnedMessage[]) || [] : [];
    const { outcome, next } = applyPin(current, entry, Timestamp.now());
    if (next) tx.set(classPinsRef, { pinned: next }, { merge: true });
    return outcome;
  });
}

export async function unpinClassMessage(messageId: string) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(classPinsRef);
    if (!snap.exists()) return;
    const current: PinnedMessage[] = (snap.data().pinned as PinnedMessage[]) || [];
    const next = applyUnpin(current, messageId);
    if (next) tx.set(classPinsRef, { pinned: next }, { merge: true });
  });
}

// ---- DM / group: pinned list lives on the conversation doc itself ----

export async function pinDMMessage(
  conversation: Conversation,
  entry: Omit<PinnedMessage, 'pinnedAt'>
): Promise<PinOutcome> {
  const ref = doc(db, 'conversations', conversation.id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 'ok' as PinOutcome;
    const current = ((snap.data().pinned as PinnedMessage[]) || []);
    const { outcome, next } = applyPin(current, entry, Timestamp.now());
    // Only `pinned` may change here -- memberPinnedOnly() in firestore.rules
    // rejects an update that touches any other key.
    if (next) tx.update(ref, { pinned: next });
    return outcome;
  });
}

export async function unpinDMMessage(conversation: Conversation, messageId: string) {
  const ref = doc(db, 'conversations', conversation.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = ((snap.data().pinned as PinnedMessage[]) || []);
    const next = applyUnpin(current, messageId);
    if (next) tx.update(ref, { pinned: next });
  });
}
