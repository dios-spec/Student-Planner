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
  createdAt: Timestamp | null;
  lastSeen?: Timestamp | null;
}

export interface Reaction {
  emoji: string;
  users: string[]; // uids who reacted with this emoji
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  imageUrl?: string;
  replyTo?: {
    id: string;
    senderName: string;
    text?: string;
  } | null;
  reactions?: Record<string, string[]>; // emoji -> uids
  createdAt: Timestamp | null;
  deleted?: boolean;
}

export interface Announcement {
  id: string;
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
