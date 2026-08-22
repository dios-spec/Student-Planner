import { doc, getDoc, setDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './config';
import type { Conversation, PinnedMessage } from '../types';

const MAX_PINNED = 20;
const classPinsRef = doc(db, 'appMeta', 'classChatPins');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

// ---- Class chat: single shared pinned list ----

export function watchClassPins(cb: (pinned: PinnedMessage[]) => void) {
  return onSnapshot(classPinsRef, (snap) => {
    cb(snap.exists() ? ((snap.data().pinned as PinnedMessage[]) || []) : []);
  });
}

export async function pinClassMessage(entry: Omit<PinnedMessage, 'pinnedAt'>): Promise<'ok' | 'full'> {
  const snap = await getDoc(classPinsRef);
  const current: PinnedMessage[] = snap.exists() ? (snap.data().pinned as PinnedMessage[]) || [] : [];
  if (current.some((p) => p.messageId === entry.messageId)) return 'ok';
  if (current.length >= MAX_PINNED) return 'full';
  const next = [...current, stripUndefined({ ...entry, pinnedAt: Timestamp.now() })];
  await setDoc(classPinsRef, { pinned: next }, { merge: true });
  return 'ok';
}

export async function unpinClassMessage(messageId: string) {
  const snap = await getDoc(classPinsRef);
  if (!snap.exists()) return;
  const current: PinnedMessage[] = (snap.data().pinned as PinnedMessage[]) || [];
  await updateDoc(classPinsRef, { pinned: current.filter((p) => p.messageId !== messageId) });
}

// ---- DM / group: pinned list lives on the conversation doc itself ----

export async function pinDMMessage(
  conversation: Conversation,
  entry: Omit<PinnedMessage, 'pinnedAt'>
): Promise<'ok' | 'full'> {
  const current = conversation.pinned || [];
  if (current.some((p) => p.messageId === entry.messageId)) return 'ok';
  if (current.length >= MAX_PINNED) return 'full';
  const next = [...current, stripUndefined({ ...entry, pinnedAt: Timestamp.now() })];
  await updateDoc(doc(db, 'conversations', conversation.id), { pinned: next });
  return 'ok';
}

export async function unpinDMMessage(conversation: Conversation, messageId: string) {
  const next = (conversation.pinned || []).filter((p) => p.messageId !== messageId);
  await updateDoc(doc(db, 'conversations', conversation.id), { pinned: next });
}
