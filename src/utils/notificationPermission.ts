/**
 * When may Buddy Planner ask for notification permission?
 *
 * Chrome owns this permission. The app cannot grant it, cannot re-prompt once
 * it has been denied, and gets exactly one good chance to ask -- a dismissed or
 * denied prompt is spent. So the rules are deliberately conservative:
 *
 *  - never during onboarding, when the person has no idea what the app is yet
 *  - never when the permission is already decided (granted needs no prompt,
 *    and once denied the browser will not show the dialog again no matter how
 *    many times we call requestPermission)
 *  - "not now" snoozes rather than dismissing forever, but only a couple of
 *    times, and never twice in the same fortnight
 *
 * The previous version wrote a single localStorage flag on dismissal and never
 * asked again, and it offered no route back for someone who had denied by
 * accident. Recovery lives in Settings instead, where it belongs.
 */

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const PROMPT_STORAGE_KEY = 'sbp_notif_prompt_v2';
export const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_ASKS = 3;
/** Long enough that the prompt never lands on top of a first impression. */
export const PROMPT_DELAY_MS = 20_000;

export interface PromptRecord {
  /** How many times we have shown our own explainer. */
  asks: number;
  /** Epoch ms of the last time we showed it. */
  lastAskedAt: number;
}

export const EMPTY_RECORD: PromptRecord = { asks: 0, lastAskedAt: 0 };

export function parsePromptRecord(raw: string | null): PromptRecord {
  if (!raw) return EMPTY_RECORD;

  // v1 stored the literal string '1' as a permanent "never ask again" flag.
  // Treat it as one previous ask rather than a life sentence.
  if (raw === '1') return { asks: 1, lastAskedAt: 0 };

  try {
    const parsed = JSON.parse(raw) as Partial<PromptRecord>;
    return {
      asks: Number.isFinite(parsed.asks) ? Number(parsed.asks) : 0,
      lastAskedAt: Number.isFinite(parsed.lastAskedAt) ? Number(parsed.lastAskedAt) : 0,
    };
  } catch {
    return EMPTY_RECORD;
  }
}

export interface PromptDecision {
  show: boolean;
  reason:
    | 'ask'
    | 'unsupported'
    | 'already-granted'
    | 'denied'
    | 'not-onboarded'
    | 'asked-too-often'
    | 'snoozed';
}

export function shouldAskForPermission(input: {
  permission: PermissionState;
  onboarded: boolean;
  record: PromptRecord;
  nowMs: number;
}): PromptDecision {
  const { permission, onboarded, record, nowMs } = input;

  if (permission === 'unsupported') return { show: false, reason: 'unsupported' };
  if (permission === 'granted') return { show: false, reason: 'already-granted' };
  // Chrome will not show the dialog again, so our explainer would be a dead
  // end. Settings offers the real recovery path instead.
  if (permission === 'denied') return { show: false, reason: 'denied' };
  if (!onboarded) return { show: false, reason: 'not-onboarded' };
  if (record.asks >= MAX_ASKS) return { show: false, reason: 'asked-too-often' };
  if (record.lastAskedAt && nowMs - record.lastAskedAt < SNOOZE_MS) {
    return { show: false, reason: 'snoozed' };
  }

  return { show: true, reason: 'ask' };
}

/**
 * Reached through globalThis rather than the DOM `Notification` global: this
 * module is also compiled under the node tsconfig for its unit tests, where the
 * DOM lib is not loaded.
 */
export function readPermission(): PermissionState {
  const api = (globalThis as { Notification?: { permission?: string } }).Notification;
  if (!api) return 'unsupported';
  const value = api.permission;
  return value === 'granted' || value === 'denied' ? value : 'default';
}
