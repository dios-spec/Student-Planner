import type { Timestamp } from 'firebase/firestore';

export type SubjectId =
  | 'maths'
  | 'english'
  | 'science'
  | 'sst'
  | 'hindi'
  | 'gujarati'
  | string; // custom subjects added later still type-check

export interface Subject {
  id: SubjectId;
  name: string;
  icon: string; // lucide icon name
  color: string; // tailwind-safe hex used for accents
  isCustom?: boolean;
}

export type PlannerCategory =
  | 'bring'
  | 'reading'
  | 'writing'
  | 'test'
  | 'project'
  | 'important';

export interface PlannerItem {
  id: string;
  classId: string; // '7A' | '7B' | '7C' — which class this item belongs to
  date: string; // 'YYYY-MM-DD', the day this item applies to
  subject: SubjectId;
  category: PlannerCategory;
  title: string;
  description?: string;
  dueDate?: string; // for projects/tests, may differ from "date"
  portion?: string; // syllabus/portion text for tests
  note?: string; // shared note e.g. "Bring cardboard + colours"
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: Timestamp | null;
  deleted?: boolean;
  deletedAt?: Timestamp | null;
}

export interface CompletionRecord {
  id: string; // `${userId}_${itemId}`
  userId: string;
  itemId: string;
  done: boolean;
  updatedAt: Timestamp | null;
}

export interface StudentProfile {
  id: string; // == firebase uid
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  emoji?: string;
  classId?: string; // '7A' | '7B' | '7C'
  moodEmoji?: string;
  moodLabel?: string;
  onboarded?: boolean;
  createdAt: Timestamp | null;
  lastSeen?: Timestamp | null;
}

export interface Reaction {
  emoji: string;
  users: string[]; // uids who reacted with this emoji
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // uids
}

export interface Poll {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  closed: boolean;
  createdBy: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: {
    id: string;
    senderName: string;
    text?: string;
  } | null;
  reactions?: Record<string, string[]>; // emoji -> uids
  createdAt: Timestamp | null;
  deleted?: boolean;
  poll?: Poll;
}

export interface Announcement {
  id: string;
  classId: string;
  title: string;
  body: string;
  forDate?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

export interface PersonalNote {
  id: string;
  ownerId: string;
  text: string;
  done?: boolean;
  createdAt: Timestamp | null;
}

export interface BlockedUser {
  id: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  imageUrl: string;
  caption?: string;
  likes?: string[]; // uids who liked
  createdAt: Timestamp | null;
}

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  mediaType?: 'image' | 'video';
  imageUrl: string;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null; // 24h after creation
  seenBy?: string[];
  likes?: string[]; // story likes
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: Timestamp | null;
}

export interface StudyMaterial {
  id: string;
  classId: string;
  subject: string;
  chapter: string;
  title: string;
  imageUrl: string;
  uploaderId: string;
  uploaderName: string;
  uploaderAvatar?: string;
  createdAt: Timestamp | null;
}

// ---- Conversations (DMs + group chats) ----
export type ConversationType = 'dm' | 'group';

export interface Conversation {
  id: string;
  type: ConversationType;
  memberIds: string[];        // all participant uids
  adminIds?: string[];        // group admins (creator starts as admin)
  // denormalized member info so the chat list renders without extra reads
  members: Record<string, { name: string; avatar?: string }>;
  // group-only
  name?: string;
  photoUrl?: string;
  description?: string;
  classId?: string;           // optional class association for groups
  createdBy?: string;
  createdAt: Timestamp | null;
  // last-message preview for the list
  lastText?: string;
  lastSenderId?: string;
  lastAt?: Timestamp | null;
  // per-user unread counts and last-read markers
  unread?: Record<string, number>;
  pinned?: PinnedMessage[];
  typing?: Record<string, { name: string; at: Timestamp }>;
  // per-user last-read timestamp, powers Sent/Delivered/Seen
  lastReadAt?: Record<string, Timestamp>;
}

export interface PinnedMessage {
  messageId: string;
  text?: string;
  senderName: string;
  pinnedBy: string;
  pinnedAt: Timestamp | null;
}

export type DMMessageKind = 'text' | 'image' | 'voice' | 'sharedPost' | 'sharedReel' | 'sharedStory' | 'poll';

export interface DMMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  kind: DMMessageKind;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;     // seconds
  // shared content preview
  shared?: {
    kind: 'post' | 'reel' | 'story';
    id: string;
    imageUrl?: string;
    thumbUrl?: string;
    caption?: string;
    authorName: string;
  };
  replyTo?: { id: string; senderName: string; preview: string } | null;
  reactions?: Record<string, string[]>;
  createdAt: Timestamp | null;
  deleted?: boolean;
  poll?: Poll;
}

export interface BlockEntry {
  id: string;       // `${blockerId}_${blockedId}`
  blockerId: string;
  blockedId: string;
  createdAt: Timestamp | null;
}

export interface Reel {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  videoUrl: string;
  thumbUrl?: string;
  caption?: string;
  likes?: string[];
  createdAt: Timestamp | null;
}

// ---- Notifications ----
export type NotifType =
  | 'dm' | 'groupMessage' | 'reply' | 'comment' | 'groupInvite'
  | 'adminPromote' | 'addedToGroup' | 'homework' | 'exam' | 'announcement'
  | 'incomingCall' | 'missedCall'
  | 'postLike'
  | 'classMessage'
  | 'classReaction'
  | 'storyNew';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotifType;
  title: string;
  body?: string;
  icon?: string;
  route?: string;
  fromUid?: string;
  data?: Record<string, string>;
  read?: boolean;
  createdAt: Timestamp | null;
}

// ---- Calls (WebRTC signalling) ----
export type CallStatus =
  | 'ringing' | 'connecting' | 'connected' | 'ended' | 'declined' | 'missed' | 'unavailable';

export interface CallDoc {
  id: string;
  conversationId: string;
  type: 'dm' | 'group';
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  groupName?: string;
  groupPhoto?: string;
  memberIds: string[];         // everyone invited to the call
  status: CallStatus;
  participants: Record<string, {
    name: string;
    avatar?: string;
    joined: boolean;
    muted?: boolean;
  }>;
  createdAt: Timestamp | null;
  endedAt?: Timestamp | null;
}
