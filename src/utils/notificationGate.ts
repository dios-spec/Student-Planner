/**
 * Client mirror of api/_lib/notificationGate.js.
 *
 * The SERVER is the authority for whether a push is actually sent. This exists
 * because the app also raises notifications itself from the Firestore
 * notification stream (see hooks/useBrowserNotifications), and that path was
 * only checking category mutes -- it ignored quiet hours entirely. So a student
 * with quiet hours on, phone on the desk, tab in the background, still got
 * buzzed at 1am by the in-page path even though the server had correctly
 * suppressed the push.
 *
 * src/utils/notificationGate.test.ts asserts this file and the server file
 * agree on a shared table of cases, so the two cannot drift apart.
 */

export interface QuietHours {
  enabled?: boolean;
  start?: string;
  end?: string;
  allowCalls?: boolean;
  allowUrgent?: boolean;
}

/**
 * Deliberately structural. The app has its own concrete NotificationSettings
 * interface; this gate only needs "an object with category flags and maybe a
 * quietHours block", so it accepts any object rather than forcing an index
 * signature onto the app's type.
 */
export type NotificationSettings = object;

export interface GateUser {
  notificationSettings?: NotificationSettings | null;
  timezone?: string;
}

function asRecord(settings: NotificationSettings | null | undefined): Record<string, unknown> | null {
  return settings ? (settings as Record<string, unknown>) : null;
}

const CATEGORY_MAP: Record<string, string> = {
  dm: 'dm', groupMessage: 'groupMessage', classMessage: 'classMessage',
  reply: 'reply', comment: 'comment',
  postLike: 'postLike', reelLike: 'reelLike', storyLike: 'storyLike',
  incomingCall: 'calls', missedCall: 'missedCall',
  homework: 'homework', exam: 'exam', announcement: 'announcement', studyHelp: 'studyHelp',
  groupInvite: 'groupEvents', adminPromote: 'groupEvents', addedToGroup: 'groupEvents',
};

/** null means no toggle exists for this type, so it is always allowed. */
export function categoryForType(type: string): string | null {
  return CATEGORY_MAP[type] || null;
}

export function isCategoryEnabled(
  settings: NotificationSettings | null | undefined,
  category: string | null
): boolean {
  const record = asRecord(settings);
  if (!category || !record) return true;
  return record[category] !== false;
}

export function isUrgentType(type: string): boolean {
  return type === 'homework' || type === 'exam' || type === 'announcement';
}

/** Local hour:minute in the given IANA timezone, as minutes since midnight. */
function localMinutes(now: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === 'hour')?.value);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value);
  return hh * 60 + mm;
}

export function isWithinQuietHours(
  now: Date,
  tz: string | undefined,
  start: string | undefined,
  end: string | undefined
): boolean {
  let nowMin: number;
  try {
    nowMin = localMinutes(now, tz || 'UTC');
  } catch {
    nowMin = localMinutes(now, 'UTC');
  }
  const [sh, sm] = (start || '22:00').split(':').map(Number);
  const [eh, em] = (end || '07:00').split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin; // wraps midnight
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
}

/** Never throws. Mirrors checkPushAllowed in api/_lib/notificationGate.js. */
export function checkNotificationAllowed(
  user: GateUser,
  notifType: string,
  now: Date = new Date()
): GateResult {
  const settings = user.notificationSettings || null;
  const category = categoryForType(notifType);

  if (!isCategoryEnabled(settings, category)) {
    return { allowed: false, reason: 'muted' };
  }

  const qh = asRecord(settings)?.quietHours as QuietHours | undefined;
  if (qh && qh.enabled) {
    const inQuiet = isWithinQuietHours(now, user.timezone, qh.start, qh.end);
    if (inQuiet) {
      const isCall = notifType === 'incomingCall';
      const urgent = isUrgentType(notifType);
      const bypassed = (isCall && qh.allowCalls) || (urgent && qh.allowUrgent);
      if (!bypassed) return { allowed: false, reason: 'quiet-hours' };
    }
  }

  return { allowed: true };
}
