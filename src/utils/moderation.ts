// Lightweight client-side filtering. This is a first line of defense, not a
// substitute for the length/type checks enforced by Firestore Security Rules.
const BLOCKED_WORDS = [
  // kept intentionally short — expand as needed for your class
  'idiot',
  'stupid',
  'hate you',
];

export function containsBlockedLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_NAME_LENGTH = 24;
export const MAX_BIO_LENGTH = 80;
export const MAX_TASK_TITLE_LENGTH = 120;
export const MAX_TASK_DESC_LENGTH = 400;
export const MAX_NOTE_LENGTH = 300;

// Very small client-side rate limiter (per message type) to discourage spam.
const lastSentAt = new Map<string, number>();
export function isRateLimited(key: string, minGapMs = 1200): boolean {
  const now = Date.now();
  const prev = lastSentAt.get(key) ?? 0;
  if (now - prev < minGapMs) return true;
  lastSentAt.set(key, now);
  return false;
}
