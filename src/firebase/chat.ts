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
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import type { ChatMessage } from '../types';
import { pushNotification, pushToStudents } from './notifications';

const messagesCol = collection(db, 'messages');
const PAGE_SIZE = 30;

export interface NewMessage {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: ChatMessage['replyTo'];
}

export async function sendMessage(msg: NewMessage) {
  // Firestore rejects `undefined` field values outright — strip any optional
  // fields (like senderAvatar or replyTo) the caller didn't provide.
  const payload: Record<string, unknown> = {
    ...msg,
    reactions: {},
    deleted: false,
    createdAt: serverTimestamp(),
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  await addDoc(messagesCol, payload);

  const preview =
    msg.text?.trim() ||
    (msg.imageUrl ? 'Photo' : msg.audioUrl ? 'Voice message' : 'New message');

  void pushToStudents(
    {
      type: 'classMessage',
      title: 'Class Chat',
      body: `${msg.senderName}: ${preview}`,
      icon: msg.senderAvatar,
      route: '/chat',
      data: { senderId: msg.senderId },
    },
    msg.senderId
  ).catch(() => {});
}

/** Live listener for the most recent page of chat — older messages are paginated on demand.
 *  BUG-18: loadOlderMessages() below was implemented but never wired to any UI,
 *  leaving all history beyond one page unreachable. */
export function watchRecentMessages(cb: (msgs: ChatMessage[]) => void) {
  const q = query(messagesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage).reverse();
    cb(msgs);
  },
    (err) => {
      // A rules denial or a lost listener used to fail silently here:
      // onSnapshot's next-callback never fires again, so any UI whose
      // loading flag is derived from 'no data yet' spins forever.
      console.error('[CHAT] watchRecentMessages failed:', err);
      cb([]);
    }
  );
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
  const before = await getDoc(ref).catch(() => null);

  await updateDoc(ref, {
    [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(uid) : arrayUnion(uid),
  });

  if (!alreadyReacted && before?.exists()) {
    const message = before.data() as ChatMessage;
    if (message.senderId && message.senderId !== uid) {
      void pushNotification(
        {
          userId: message.senderId,
          type: 'classReaction',
          title: 'New reaction in Class Chat',
          body: `Someone reacted ${emoji} to your message`,
          route: '/chat',
          data: { messageId },
        },
        uid
      ).catch(() => {});
    }
  }
}

/** Students may only delete their own recent messages (enforced again by Security Rules). */
export async function deleteOwnMessage(messageId: string) {
  await updateDoc(doc(messagesCol, messageId), { deleted: true, text: '', imageUrl: '' });
}

export async function editMessage(messageId: string, newText: string) {
  await updateDoc(doc(messagesCol, messageId), { text: newText.trim().slice(0, 500), edited: true });
}

export async function reportMessage(messageId: string, reporterId: string) {
  await addDoc(collection(db, 'reports'), {
    messageId,
    reporterId,
    createdAt: serverTimestamp(),
  });
}

export interface NewPoll {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
}

export async function sendPoll(p: NewPoll) {
  const options = p.options.map((text, i) => ({ id: String(i), text, votes: [] as string[] }));
  const payload: Record<string, unknown> = {
    senderId: p.senderId,
    senderName: p.senderName,
    senderAvatar: p.senderAvatar,
    poll: {
      question: p.question,
      options,
      allowMultiple: p.allowMultiple,
      closed: false,
      createdBy: p.senderId,
    },
    reactions: {},
    deleted: false,
    createdAt: serverTimestamp(),
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  await addDoc(messagesCol, payload);

  void pushToStudents(
    {
      type: 'classMessage',
      title: 'Class Chat',
      body: p.senderName + ' started a poll: ' + p.question,
      icon: p.senderAvatar,
      route: '/chat',
      data: { senderId: p.senderId },
    },
    p.senderId
  ).catch(() => {});
}

export async function voteOnPoll(messageId: string, optionId: string, uid: string) {
  const ref = doc(messagesCol, messageId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as ChatMessage;
    if (!data.poll || data.poll.closed) return;
    const already = data.poll.options.find((o) => o.id === optionId)?.votes.includes(uid) ?? false;
    const options = data.poll.options.map((o) => {
      let votes = o.votes.slice();
      if (!data.poll!.allowMultiple) {
        votes = votes.filter((v) => v !== uid);
      } else if (o.id === optionId) {
        votes = votes.filter((v) => v !== uid);
      }
      return { ...o, votes };
    });
    const target = options.find((o) => o.id === optionId);
    if (target && !already) target.votes.push(uid);
    tx.update(ref, { 'poll.options': options });
  });
}

export async function closePoll(messageId: string) {
  await updateDoc(doc(messagesCol, messageId), { 'poll.closed': true });
}
