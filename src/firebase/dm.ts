import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import type { DMMessage, Conversation } from '../types';
import { pushNotification, pushToMany } from './notifications';

const convCol = collection(db, 'conversations');

function msgCol(conversationId: string) {
  return collection(db, 'conversations', conversationId, 'messages');
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export interface SendArgs {
  conversation: Conversation;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  kind: DMMessage['kind'];
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  shared?: DMMessage['shared'];
  poll?: DMMessage['poll'];
  replyTo?: DMMessage['replyTo'];
}

function previewFor(a: SendArgs): string {
  switch (a.kind) {
    case 'text': return a.text || '';
    case 'image': return '📷 Photo';
    case 'voice': return '🎤 Voice message';
    case 'sharedPost': return '📮 Shared a post';
    case 'sharedReel': return '🎬 Shared a reel';
    case 'sharedStory': return '✨ Shared a story';
    case 'poll': return '📊 Poll: ' + (a.poll ? a.poll.question : '');
    default: return '';
  }
}

/** Send a message and update the conversation preview + everyone else's unread count. */
export async function sendDM(a: SendArgs) {
  const batch = writeBatch(db);

  const newMsgRef = doc(msgCol(a.conversation.id));
  batch.set(newMsgRef, stripUndefined({
    conversationId: a.conversation.id,
    senderId: a.senderId,
    senderName: a.senderName,
    senderAvatar: a.senderAvatar,
    kind: a.kind,
    text: a.text,
    imageUrl: a.imageUrl,
    audioUrl: a.audioUrl,
    audioDuration: a.audioDuration,
    shared: a.shared,
    poll: a.poll,
    replyTo: a.replyTo ?? null,
    reactions: {},
    deleted: false,
    createdAt: serverTimestamp(),
  }));

  const convRef = doc(convCol, a.conversation.id);
  const convPatch: Record<string, unknown> = {
    lastText: previewFor(a),
    lastSenderId: a.senderId,
    lastAt: serverTimestamp(),
  };
  // bump unread for every member except the sender
  a.conversation.memberIds.forEach((mid) => {
    if (mid !== a.senderId) convPatch[`unread.${mid}`] = increment(1);
  });
  batch.update(convRef, convPatch);

  await batch.commit();

  // Notify the other member(s). DMs → the one other person; groups → everyone else.
  const preview = previewFor(a);
  const others = a.conversation.memberIds.filter((m) => m !== a.senderId);
  if (a.conversation.type === 'group') {
    await pushToMany(
      others,
      {
        type: a.replyTo ? 'reply' : 'groupMessage',
        title: `${a.conversation.name || 'Group'}`,
        body: `${a.senderName}: ${preview}`,
        icon: a.conversation.photoUrl,
        route: `/messages?open=${a.conversation.id}`,
      },
      a.senderId
    );
  } else {
    await Promise.all(
      others.map((uid) =>
        pushNotification({
          userId: uid,
          type: a.replyTo ? 'reply' : 'dm',
          title: a.senderName,
          body: preview,
          icon: a.senderAvatar,
          route: `/messages?open=${a.conversation.id}`,
        })
      )
    );
  }
}

const PAGE = 40;

/** Live listener for a conversation's most recent messages. */
export function watchDMMessages(conversationId: string, cb: (msgs: DMMessage[]) => void) {
  const q = query(msgCol(conversationId), orderBy('createdAt', 'desc'), limit(PAGE));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DMMessage).reverse());
  });
}

export async function toggleDMReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  uid: string,
  already: boolean
) {
  const ref = doc(msgCol(conversationId), messageId);
  const before = await getDoc(ref).catch(() => null);

  await updateDoc(ref, {
    [`reactions.${emoji}`]: already ? arrayRemove(uid) : arrayUnion(uid),
  });

  if (!already && before?.exists()) {
    const original = before.data() as DMMessage;
    if (original.senderId && original.senderId !== uid) {
      void pushNotification(
        {
          userId: original.senderId,
          type: 'reply',
          title: 'New reaction',
          body: `${emoji} on your message`,
          route: `/messages?open=${conversationId}`,
          data: { conversationId, messageId },
        },
        uid
      ).catch(() => {});
    }
  }
}

export async function editDMMessage(conversationId: string, messageId: string, newText: string) {
  await updateDoc(doc(msgCol(conversationId), messageId), { text: newText.trim().slice(0, 2000), edited: true });
}

export async function deleteDMMessage(conversationId: string, messageId: string) {
  await updateDoc(doc(msgCol(conversationId), messageId), {
    deleted: true,
    text: '',
    imageUrl: '',
    audioUrl: '',
  });
}

export async function voteOnDMPoll(conversationId: string, messageId: string, optionId: string, uid: string) {
  const ref = doc(msgCol(conversationId), messageId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as DMMessage;
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

export async function closeDMPoll(conversationId: string, messageId: string) {
  await updateDoc(doc(msgCol(conversationId), messageId), { 'poll.closed': true });
}

// ---- Media/Links/Voice/Shared browser: fetched on-demand per tab, not upfront ----

export async function getDMMediaOnce(conversationId: string): Promise<DMMessage[]> {
  const q = query(msgCol(conversationId), where('kind', '==', 'image'), orderBy('createdAt', 'desc'), limit(60));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DMMessage);
}

export async function getDMVoiceOnce(conversationId: string): Promise<DMMessage[]> {
  const q = query(msgCol(conversationId), where('kind', '==', 'voice'), orderBy('createdAt', 'desc'), limit(60));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DMMessage);
}

export async function getDMSharedOnce(conversationId: string): Promise<DMMessage[]> {
  const q = query(msgCol(conversationId), where('kind', 'in', ['sharedPost', 'sharedReel', 'sharedStory']), orderBy('createdAt', 'desc'), limit(60));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DMMessage);
}

const URL_RE = /https?:\/\/[^\s]+/i;

/** No `containsLink` field exists at write time, so this scans recent text
 * messages client-side -- fine for a single conversation's volume, but a
 * different mechanism than the other three (indexed) tabs. */
export async function getDMLinksOnce(conversationId: string): Promise<DMMessage[]> {
  const q = query(msgCol(conversationId), where('kind', '==', 'text'), orderBy('createdAt', 'desc'), limit(300));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DMMessage)
    .filter((m) => m.text && URL_RE.test(m.text))
    .slice(0, 60);
}
