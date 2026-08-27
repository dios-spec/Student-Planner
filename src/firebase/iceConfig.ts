import { auth } from './config';

/**
 * ICE servers for WebRTC.
 *
 * These used to be read from VITE_TURN_URL / VITE_TURN_USERNAME /
 * VITE_TURN_CREDENTIAL. Every VITE_ variable is compiled into the public
 * bundle, so the permanent relay credentials were readable by anyone who
 * opened the site and could be used to relay arbitrary traffic through the
 * account. They now come from an authenticated request to /api/ice-servers and
 * the permanent secret never reaches the browser.
 *
 * STUN is always present as a floor, so a same-network call still works even
 * if the endpoint is unreachable.
 */
const STUN_ONLY: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Refresh a little before the server's TTL so a call never starts on stale creds. */
const SAFETY_MARGIN_MS = 30_000;
const MIN_CACHE_MS = 30_000;

let cache: { servers: RTCIceServer[]; expiresAt: number } | null = null;
let inFlight: Promise<RTCIceServer[]> | null = null;

interface IceResponse {
  iceServers?: unknown;
  ttlSeconds?: unknown;
}

function isUsable(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== 'object') return false;
  const urls = (value as RTCIceServer).urls;
  if (typeof urls === 'string') return /^(stun|turns?):/i.test(urls);
  return Array.isArray(urls) && urls.some((u) => typeof u === 'string' && /^(stun|turns?):/i.test(u));
}

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const user = auth.currentUser;
    if (!user) return STUN_ONLY;

    const idToken = await user.getIdToken();
    const response = await fetch('/api/ice-servers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    const payload = (await response.json().catch(() => ({}))) as IceResponse;
    const servers = Array.isArray(payload.iceServers) ? payload.iceServers.filter(isUsable) : [];

    if (!servers.length) return STUN_ONLY;

    const ttlMs = Number.isFinite(payload.ttlSeconds) ? Number(payload.ttlSeconds) * 1000 : 0;
    cache = {
      servers,
      expiresAt: Date.now() + Math.max(MIN_CACHE_MS, ttlMs - SAFETY_MARGIN_MS),
    };
    return servers;
  } catch {
    // A relay we cannot reach must not stop the call being attempted at all.
    return STUN_ONLY;
  }
}

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cache && Date.now() < cache.expiresAt) return cache.servers;
  // Collapse the burst of parallel calls a mesh makes when several peers join
  // at once into a single request.
  if (!inFlight) {
    inFlight = fetchIceServers().finally(() => { inFlight = null; });
  }
  return inFlight;
}

/** Drop cached credentials, e.g. after sign-out or account deletion. */
export function clearIceCache(): void {
  cache = null;
}
