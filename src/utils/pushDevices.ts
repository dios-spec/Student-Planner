/**
 * pushDevices/{uid} document shape and the rules for maintaining it.
 *
 * Previous shape was `{ fcmToken, fcmTokens: arrayUnion(token), pushUpdatedAt }`
 * and it had three real problems:
 *
 *  1. arrayUnion only ever GREW the array, and firestore.rules caps fcmTokens
 *     at a fixed size. Chrome rotates FCM registration tokens periodically, so
 *     a single long-lived device slowly fills the array on its own. Once the
 *     cap was reached every subsequent write was rejected by the rules, the new
 *     token was never stored, and push silently stopped working for that user
 *     -- permanently, with no error surfaced anywhere.
 *  2. There were no per-token timestamps, so nothing could ever be pruned. A
 *     token from a browser profile the student used once in September was still
 *     being fanned out to in June.
 *  3. It wrote on every single app start, whether or not anything had changed.
 *
 * The document now carries `devices`, a bounded, timestamped, newest-first
 * list. `fcmTokens` is kept as a flat mirror so the existing server fan-out
 * keeps working unchanged.
 */

export const MAX_DEVICES = 10;
export const DEVICE_TTL_DAYS = 60;
/** Re-stamping more often than this is pointless write traffic. */
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DeviceEntry {
  token: string;
  /** Epoch ms. Plain number rather than a Timestamp so it survives inside an array. */
  updatedAt: number;
  /** Short, coarse device label to make the list legible to a human. */
  label?: string;
}

export interface PushDeviceDoc {
  fcmToken?: string;
  fcmTokens?: string[];
  devices?: DeviceEntry[];
}

export interface NextDeviceState {
  devices: DeviceEntry[];
  fcmTokens: string[];
  fcmToken: string;
  /** False when the stored document already says exactly this. */
  changed: boolean;
}

function isEntry(value: unknown): value is DeviceEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as DeviceEntry).token === 'string' &&
    !!(value as DeviceEntry).token
  );
}

/** Legacy documents only have a flat token array; adopt it with a fresh stamp. */
function readExisting(doc: PushDeviceDoc | null, nowMs: number): DeviceEntry[] {
  if (doc?.devices?.length) {
    return doc.devices.filter(isEntry).map((entry) => ({
      token: entry.token,
      updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : nowMs,
      ...(entry.label ? { label: entry.label } : {}),
    }));
  }

  // Migration: unknown age, so stamp them now rather than pruning a token that
  // might be someone's only working device.
  return (doc?.fcmTokens || [])
    .filter((token): token is string => typeof token === 'string' && !!token)
    .map((token) => ({ token, updatedAt: nowMs }));
}

/**
 * Compute the document this device should write. Pure, so the decision to skip
 * a redundant write is testable.
 */
export function nextDeviceState(
  doc: PushDeviceDoc | null,
  token: string,
  nowMs: number,
  label?: string
): NextDeviceState {
  const cutoff = nowMs - DEVICE_TTL_DAYS * DAY_MS;

  const previous = readExisting(doc, nowMs);
  const kept = previous.filter((entry) => entry.token !== token && entry.updatedAt >= cutoff);

  const mine: DeviceEntry = { token, updatedAt: nowMs, ...(label ? { label } : {}) };

  const devices = [mine, ...kept]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_DEVICES);

  const fcmTokens = devices.map((entry) => entry.token);

  // Idempotence: if this token is already the newest entry, the set is
  // unchanged, and it was stamped recently, there is nothing worth writing.
  const priorMine = previous.find((entry) => entry.token === token);
  const sameSet =
    doc?.fcmTokens?.length === fcmTokens.length &&
    (doc?.fcmTokens || []).every((value, index) => value === fcmTokens[index]);
  const fresh = !!priorMine && nowMs - priorMine.updatedAt < REFRESH_AFTER_MS;
  const alreadyCurrent = doc?.fcmToken === token;

  return {
    devices,
    fcmTokens,
    fcmToken: token,
    changed: !(sameSet && fresh && alreadyCurrent && !!doc?.devices?.length),
  };
}

/** Coarse, non-identifying device label for the settings list. */
export function deviceLabel(userAgent: string | undefined): string {
  const ua = userAgent || '';
  const platform = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X/i.test(ua)
          ? 'Mac'
          : 'Device';
  const surface = /wv|; wv\)/.test(ua) ? 'App' : /Chrome/i.test(ua) ? 'Chrome' : 'Browser';
  return `${platform} ${surface}`;
}
