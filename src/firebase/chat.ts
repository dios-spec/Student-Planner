import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDocs,
} from 'firebase/firestore';
import { db } from './config';
import type { ChatMessage } from '../types';

const messagesCol = collection(db, 'messages');
const PAGE_SIZE = 30;

export interface NewMessage {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  imageUrl?: string;
  replyTo?: ChatMessage['replyTo'];
}

export async function sendMessage(msg: NewMessage) {
  await addDoc(messagesCol, {
    ...msg,
    reactions: {},
    deleted: false,
    createdAt: serverTimestamp(),
  });
}

/** Live listener for the most recent page of chat — older messages are paginated on demand. */
export function watchRecentMessages(cb: (msgs: ChatMessage[]) => void) {
  const q = query(messagesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage).reverse();
    cb(msgs);
  });
}

export async function loadOlderMessages(beforeCreatedAt: unknown): Promise<ChatMessage[]> {
  const q = query(
    messagesCol,
    orderBy('createdAt', 'desc'),
    startAfter(beforeCreatedAt),
    limit(PAGE_SIZE)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage).reverse();
}

export async function toggleReaction(messageId: string, emoji: string, uid: string, alreadyReacted: boolean) {
  const ref = doc(messagesCol, messageId);
  await updateDoc(ref, {
    [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(uid) : arrayUnion(uid),
  });
}

/** Students may only delete their own recent messages (enforced again by Security Rules). */
export async function deleteOwnMessage(messageId: string) {
  await updateDoc(doc(messagesCol, messageId), { deleted: true, text: '', imageUrl: '' });
}

export async function reportMessage(messageId: string, reporterId: string) {
  await addDoc(collection(db, 'reports'), {
    messageId,
    reporterId,
    createdAt: serverTimestamp(),
  });
}
