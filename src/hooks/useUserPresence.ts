import { relativeTime } from '../utils/date';
import type { StudentProfile } from '../types';

const ONLINE_WINDOW_MS = 90 * 1000;

export interface PresenceInfo {
  online: boolean;
  label: string;
}

/** Derives an "Online" / "Last seen X ago" label from a profile's lastSeen field.
 * Reuses the same field the existing "X active" class-chat pill already reads --
 * no new listener, no new collection. */
export function presenceFromProfile(profile: StudentProfile | null | undefined): PresenceInfo | null {
  if (!profile?.lastSeen) return null;
  const seenAt = profile.lastSeen.toDate ? profile.lastSeen.toDate() : null;
  if (!seenAt) return null;
  const online = Date.now() - seenAt.getTime() < ONLINE_WINDOW_MS;
  return { online, label: online ? 'Online' : `Last seen ${relativeTime(seenAt)}` };
}
