import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { db } from './config';
import type { ChatMessage } from '../types';
import { pushNotification, pushToTeachers } from './notifications';

const teacherMessagesCol = collection(db, 'teacherMessages');
const PAGE_SIZE = 60;

export interface NewTeacherMessage {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: ChatMessage['replyTo'];
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((key) => clean[key] === undefined && delete clean[key]);
  return clean;
}

export async function sendTeacherMessage(msg: NewTeacherMessage) {
  await addDoc(
    teacherMessagesCol,
    stripUndefined({
      ...msg,
      reactions: {},
      deleted: false,
      createdAt: serverTimestamp(),
    })
  );

  const preview =
    msg.text?.trim() ||
    (msg.imageUrl ? 'Photo' : msg.audioUrl ? 'Voice message' : 'New message');

  void pushToTeachers(
    {
      type: 'classMessage',
      title: 'Teachers Chat',
      body: `${msg.senderName}: ${preview}`,
      icon: msg.senderAvatar,
      route: '/chat',
      data: { senderId: msg.senderId, channel: 'teachers' },
    },
    msg.senderId
  ).catch(() => {});
}

export function watchRecentTeacherMessages(cb: (messages: ChatMessage[]) => void) {
  const q = query(teacherMessagesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage).reverse());
  });
}

export async function toggleTeacherReaction(
  messageId: string,
  emoji: string,
  uid: string,
  alreadyReacted: boolean
) {
  const ref = doc(teacherMessagesCol, messageId);
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
          title: 'New reaction in Teachers Chat',
          body: `Someone reacted ${emoji} to your message`,
          route: '/chat',
          data: { messageId, channel: 'teachers' },
        },
        uid
      ).catch(() => {});
    }
  }
}

export async function deleteOwnTeacherMessage(messageId: string) {
  await updateDoc(doc(teacherMessagesCol, messageId), {
    deleted: true,
    text: '',
    imageUrl: '',
  });
}

export async function editTeacherMessage(messageId: string, newText: string) {
  await updateDoc(doc(teacherMessagesCol, messageId), {
    text: newText.trim().slice(0, 500),
    edited: true,
  });
}

export async function reportTeacherMessage(messageId: string, reporterId: string) {
  await addDoc(collection(db, 'reports'), {
    messageId,
    reporterId,
    source: 'teacherChat',
    createdAt: serverTimestamp(),
  });
}

export interface NewTeacherPoll {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
}

export async function sendTeacherPoll(p: NewTeacherPoll) {
  const options = p.options.map((text, i) => ({
    id: String(i),
    text,
    votes: [] as string[],
  }));

  await addDoc(
    teacherMessagesCol,
    stripUndefined({
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
    })
  );

  void pushToTeachers(
    {
      type: 'classMessage',
      title: 'Teachers Chat',
      body: `${p.senderName} started a poll: ${p.question}`,
      icon: p.senderAvatar,
      route: '/chat',
      data: { senderId: p.senderId, channel: 'teachers' },
    },
    p.senderId
  ).catch(() => {});
}

export async function voteOnTeacherPoll(messageId: string, optionId: string, uid: string) {
  const ref = doc(teacherMessagesCol, messageId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    const data = snap.data() as ChatMessage;
    if (!data.poll || data.poll.closed) return;

    const already =
      data.poll.options.find((option) => option.id === optionId)?.votes.includes(uid) ?? false;

    const options = data.poll.options.map((option) => {
      let votes = option.votes.slice();
      if (!data.poll!.allowMultiple) {
        votes = votes.filter((v) => v !== uid);
      } else if (option.id === optionId) {
        votes = votes.filter((v) => v !== uid);
      }
      return { ...option, votes };
    });

    const target = options.find((option) => option.id === optionId);
    if (target && !already) target.votes.push(uid);

    tx.update(ref, { 'poll.options': options });
  });
}

export async function closeTeacherPoll(messageId: string) {
  await updateDoc(doc(teacherMessagesCol, messageId), { 'poll.closed': true });
}
