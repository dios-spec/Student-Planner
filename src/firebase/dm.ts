import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
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
  replyTo?: DMMessage['replyTo'];
}

function previewFor(a: SendArgs): string {
  switch (a.kind) {
    case 'text': return a.text || '';
    case 'image': return '📷 Photo';
    case 'voice': return '🎤 Voice message';
    case 'sharedPost': return '📮 Shared a post';
    case 'sharedReel': return '🎬 Shared a reel';
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
        type: 'groupMessage',
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
          type: 'dm',
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
  await updateDoc(doc(msgCol(conversationId), messageId), {
    [`reactions.${emoji}`]: already ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function deleteDMMessage(conversationId: string, messageId: string) {
  await updateDoc(doc(msgCol(conversationId), messageId), {
    deleted: true,
    text: '',
    imageUrl: '',
    audioUrl: '',
  });
}
