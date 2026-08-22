import { doc, setDoc, updateDoc, onSnapshot, Timestamp, deleteField } from 'firebase/firestore';
import { db } from './config';

const classTypingRef = doc(db, 'appMeta', 'classChatTyping');
const STALE_MS = 8000;

function liveEntries(
  map: Record<string, { name: string; at: Timestamp }> | undefined,
  excludeUid: string
): string[] {
  const now = Date.now();
  return Object.entries(map || {})
    .filter(([uid, v]) => uid !== excludeUid && v && v.at && now - v.at.toMillis() < STALE_MS)
    .map(([, v]) => v.name);
}

export function watchClassTyping(myUid: string, cb: (names: string[]) => void) {
  return onSnapshot(classTypingRef, (snap) => {
    cb(liveEntries(snap.exists() ? snap.data().typing : undefined, myUid));
  });
}

export async function setClassTyping(uid: string, name: string, isTyping: boolean) {
  await setDoc(
    classTypingRef,
    { typing: { [uid]: isTyping ? { name, at: Timestamp.now() } : deleteField() } },
    { merge: true }
  ).catch(() => {});
}

export async function setConversationTyping(
  conversationId: string,
  uid: string,
  name: string,
  isTyping: boolean
) {
  const patch: Record<string, unknown> = {};
  patch['typing.' + uid] = isTyping ? { name, at: Timestamp.now() } : deleteField();
  await updateDoc(doc(db, 'conversations', conversationId), patch).catch(() => {});
}

export function typingNamesFrom(
  typing: Record<string, { name: string; at: Timestamp }> | undefined,
  myUid: string
): string[] {
  return liveEntries(typing, myUid);
}
