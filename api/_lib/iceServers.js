/**
 * ICE server configuration, assembled server-side.
 *
 * Until now the TURN username and credential were read from VITE_TURN_* in the
 * browser. Every VITE_ variable is compiled into the public JS bundle, so the
 * permanent relay credentials shipped to anyone who opened the site and could
 * be lifted straight out of the bundle and used to relay arbitrary traffic
 * through the account. They are now fetched, per call, by an authenticated
 * request, and the permanent secret never leaves the server.
 */

export const STUN_ONLY = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Short enough that a leaked credential is worth little. */
export const CREDENTIAL_TTL_SECONDS = 600;
export const MAX_SERVERS = 12;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 20;

function isTurnUrl(value) {
  return typeof value === 'string' && /^turns?:/i.test(value.trim());
}

/**
 * Validate whatever the provider returned before handing it to a browser.
 * Anything that is not a well-formed TURN/STUN entry is dropped rather than
 * passed through.
 */
export function normalizeIceServers(input) {
  const list = Array.isArray(input) ? input : [];
  const out = [];

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;

    const urls = Array.isArray(entry.urls)
      ? entry.urls.filter((u) => typeof u === 'string' && u.trim())
      : (typeof entry.urls === 'string' && entry.urls.trim() ? [entry.urls.trim()] : []);
    if (!urls.length) continue;

    const usable = urls.filter((u) => isTurnUrl(u) || /^stun:/i.test(u.trim()));
    if (!usable.length) continue;

    const server = { urls: usable.length === 1 ? usable[0] : usable };

    if (usable.some(isTurnUrl)) {
      if (typeof entry.username !== 'string' || !entry.username) continue;
      if (typeof entry.credential !== 'string' || !entry.credential) continue;
      server.username = entry.username;
      server.credential = entry.credential;
    }

    out.push(server);
    if (out.length >= MAX_SERVERS) break;
  }

  return out;
}

/**
 * Fallback for deployments that only hold static credentials.
 *
 * Still a real improvement on the old arrangement: the credential is no longer
 * in the public bundle, and only an authenticated user can obtain it. Note the
 * variables are NOT prefixed VITE_, which is what kept them out of the client.
 */
export function staticTurnFromEnv(env) {
  const url = (env.TURN_URL || '').trim();
  const username = (env.TURN_USERNAME || '').trim();
  const credential = (env.TURN_CREDENTIAL || '').trim();
  if (!url || !username || !credential) return [];

  return normalizeIceServers(
    url.split(',').map((u) => ({ urls: u.trim(), username, credential })).filter((s) => s.urls)
  );
}

/** Metered's temporary-credential endpoint. The API key stays server-side. */
export function meteredCredentialsUrl(env) {
  const app = (env.METERED_APP_NAME || '').trim();
  const key = (env.METERED_API_KEY || '').trim();
  if (!app || !key) return null;
  return `https://${encodeURIComponent(app)}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`;
}

/**
 * Per-instance sliding-window limiter. Serverless spreads requests across
 * instances so this is a speed bump, not a hard guarantee -- enough to stop one
 * client hammering the endpoint, which is the realistic abuse here given every
 * request is already authenticated.
 */
export function rateLimit(store, key, nowMs, max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS) {
  const hits = (store.get(key) || []).filter((t) => nowMs - t < windowMs);

  if (hits.length >= max) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (nowMs - hits[0])) / 1000));
    store.set(key, hits);
    return { allowed: false, retryAfter };
  }

  hits.push(nowMs);
  store.set(key, hits);
  return { allowed: true, retryAfter: 0 };
}

/** Drop expired buckets so a long-lived instance cannot grow without bound. */
export function pruneRateLimitStore(store, nowMs, windowMs = RATE_LIMIT_WINDOW_MS) {
  for (const [key, hits] of store) {
    const live = hits.filter((t) => nowMs - t < windowMs);
    if (live.length) store.set(key, live);
    else store.delete(key);
  }
  return store.size;
}
