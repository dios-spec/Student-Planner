const CATEGORY_MAP = {
  dm: 'dm', groupMessage: 'groupMessage', classMessage: 'classMessage',
  reply: 'reply', comment: 'comment',
  postLike: 'postLike', reelLike: 'reelLike', storyLike: 'storyLike',
  incomingCall: 'calls', missedCall: 'missedCall',
  homework: 'homework', exam: 'exam', announcement: 'announcement',
  groupInvite: 'groupEvents', adminPromote: 'groupEvents', addedToGroup: 'groupEvents',
};

export function categoryForType(type) {
  return CATEGORY_MAP[type] || null; // null = no toggle exists, always allowed
}

export function isCategoryEnabled(settings, category) {
  if (!category || !settings) return true;
  return settings[category] !== false;
}

export function isUrgentType(type) {
  return type === 'homework' || type === 'exam' || type === 'announcement';
}

/** Local hour:minute in the given IANA timezone, minutes-since-midnight. */
function localMinutes(now, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === 'hour').value);
  const mm = Number(parts.find((p) => p.type === 'minute').value);
  return hh * 60 + mm;
}

export function isWithinQuietHours(now, tz, start, end) {
  let nowMin, startMin, endMin;
  try {
    nowMin = localMinutes(now, tz || 'UTC');
  } catch {
    nowMin = localMinutes(now, 'UTC');
  }
  const [sh, sm] = (start || '22:00').split(':').map(Number);
  const [eh, em] = (end || '07:00').split(':').map(Number);
  startMin = sh * 60 + sm;
  endMin = eh * 60 + em;
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin; // wraps midnight
}

/** Single entry point both send-push.js and send-reminders.js call.
 * Returns { allowed: boolean, reason?: string }. Never throws. */
export function checkPushAllowed(user, notifType) {
  const settings = user.notificationSettings || null;
  const category = categoryForType(notifType);

  if (!isCategoryEnabled(settings, category)) {
    return { allowed: false, reason: 'muted' };
  }

  const qh = settings && settings.quietHours;
  if (qh && qh.enabled) {
    const inQuiet = isWithinQuietHours(new Date(), user.timezone, qh.start, qh.end);
    if (inQuiet) {
      const isCall = notifType === 'incomingCall';
      const urgent = isUrgentType(notifType);
      const bypassed = (isCall && qh.allowCalls) || (urgent && qh.allowUrgent);
      if (!bypassed) return { allowed: false, reason: 'quiet-hours' };
    }
  }

  return { allowed: true };
}
