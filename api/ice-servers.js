import { getAuth } from 'firebase-admin/auth';
import { adminApp } from './_lib/firebaseAdmin.js';
import {
  CREDENTIAL_TTL_SECONDS,
  STUN_ONLY,
  meteredCredentialsUrl,
  normalizeIceServers,
  pruneRateLimitStore,
  rateLimit,
  staticTurnFromEnv,
} from './_lib/iceServers.js';

const AUTH_ERROR_CODES = new Set([
  'auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error',
  'auth/invalid-id-token', 'auth/user-disabled', 'auth/user-not-found',
]);

/** Per-instance. See rateLimit() for why this is a speed bump, not a guarantee. */
const hits = new Map();
let lastPrune = 0;

export default async function handler(req, res) {
  // Credentials are short-lived and per-user; they must never be cached by a
  // proxy or shared between users.
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Vary', 'Authorization');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    // STUN alone still lets same-network calls work, so an unauthenticated
    // caller gets something usable but nothing that costs money to relay.
    return res.status(401).json({ error: 'Authentication required', iceServers: STUN_ONLY });
  }

  try {
    adminApp();

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(authHeader.slice(7), true);
    } catch (error) {
      const code = error && typeof error === 'object' ? String(error.code || '') : '';
      if (AUTH_ERROR_CODES.has(code)) {
        return res.status(401).json({ error: 'Invalid or expired session', iceServers: STUN_ONLY });
      }
      throw error;
    }

    const now = Date.now();
    if (now - lastPrune > 60_000) { pruneRateLimitStore(hits, now); lastPrune = now; }

    const gate = rateLimit(hits, decoded.uid, now);
    if (!gate.allowed) {
      res.setHeader('Retry-After', String(gate.retryAfter));
      return res.status(429).json({ error: 'Too many requests', iceServers: STUN_ONLY });
    }

    // Preferred: ask the provider for a fresh, short-lived credential.
    const meteredUrl = meteredCredentialsUrl(process.env);
    if (meteredUrl) {
      try {
        const upstream = await fetch(meteredUrl, { signal: AbortSignal.timeout(5000) });
        if (upstream.ok) {
          const servers = normalizeIceServers(await upstream.json());
          if (servers.length) {
            return res.status(200).json({
              iceServers: [...STUN_ONLY, ...servers],
              ttlSeconds: CREDENTIAL_TTL_SECONDS,
              source: 'provider',
            });
          }
        }
        // Never log the URL: it carries the API key as a query parameter.
        console.warn('[ICE] provider returned no usable servers, status', upstream.status);
      } catch {
        console.warn('[ICE] provider request failed');
      }
    }

    // Fallback: static server-side credentials. Not short-lived, but no longer
    // in the public bundle and only reachable by an authenticated user.
    const staticServers = staticTurnFromEnv(process.env);
    if (staticServers.length) {
      return res.status(200).json({
        iceServers: [...STUN_ONLY, ...staticServers],
        ttlSeconds: CREDENTIAL_TTL_SECONDS,
        source: 'static',
      });
    }

    // Nothing configured. Calls still work on the same network via STUN.
    return res.status(200).json({ iceServers: STUN_ONLY, ttlSeconds: CREDENTIAL_TTL_SECONDS, source: 'stun-only' });
  } catch (error) {
    console.error('[ICE]', error instanceof Error ? error.message : 'Unknown error');
    return res.status(200).json({ iceServers: STUN_ONLY, ttlSeconds: 60, source: 'error-fallback' });
  }
}
