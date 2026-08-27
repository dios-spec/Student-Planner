import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SERVERS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  STUN_ONLY,
  meteredCredentialsUrl,
  normalizeIceServers,
  pruneRateLimitStore,
  rateLimit,
  staticTurnFromEnv,
} from './iceServers.js';

const NOW = 1_800_000_000_000;

test('a well-formed provider response passes through', () => {
  const out = normalizeIceServers([
    { urls: 'stun:stun.relay.test:80' },
    { urls: 'turn:relay.test:80', username: 'u', credential: 'c' },
    { urls: ['turn:relay.test:443', 'turns:relay.test:443'], username: 'u', credential: 'c' },
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[1].username, 'u');
  assert.deepEqual(out[2].urls, ['turn:relay.test:443', 'turns:relay.test:443']);
});

test('a TURN entry without credentials is DROPPED, not passed through half-formed', () => {
  assert.deepEqual(normalizeIceServers([{ urls: 'turn:relay.test:80' }]), []);
  assert.deepEqual(normalizeIceServers([{ urls: 'turn:relay.test:80', username: 'u' }]), []);
  assert.deepEqual(normalizeIceServers([{ urls: 'turn:relay.test:80', credential: 'c' }]), []);
});

test('STUN needs no credentials', () => {
  assert.equal(normalizeIceServers([{ urls: 'stun:stun.test:19302' }]).length, 1);
});

test('junk and hostile shapes never reach the browser', () => {
  assert.deepEqual(normalizeIceServers(null), []);
  assert.deepEqual(normalizeIceServers('nope'), []);
  assert.deepEqual(normalizeIceServers([null, 42, 'x', {}, { urls: '' }, { urls: [] }]), []);
  // Not a STUN/TURN scheme at all.
  assert.deepEqual(normalizeIceServers([{ urls: 'https://evil.test', username: 'u', credential: 'c' }]), []);
});

test('non-string credentials are rejected', () => {
  assert.deepEqual(
    normalizeIceServers([{ urls: 'turn:relay.test:80', username: 1, credential: {} }]),
    []
  );
});

test('the server list is capped', () => {
  const many = Array.from({ length: 50 }, () => ({ urls: 'turn:relay.test:80', username: 'u', credential: 'c' }));
  assert.equal(normalizeIceServers(many).length, MAX_SERVERS);
});

test('static env TURN is expanded from a comma-separated list', () => {
  const out = staticTurnFromEnv({
    TURN_URL: 'turn:a.test:80, turn:a.test:443 ,turns:a.test:443',
    TURN_USERNAME: 'u',
    TURN_CREDENTIAL: 'c',
  });
  assert.equal(out.length, 3);
  assert.ok(out.every((s) => s.username === 'u' && s.credential === 'c'));
});

test('static TURN is skipped unless all three values are present', () => {
  assert.deepEqual(staticTurnFromEnv({}), []);
  assert.deepEqual(staticTurnFromEnv({ TURN_URL: 'turn:a.test:80' }), []);
  assert.deepEqual(staticTurnFromEnv({ TURN_URL: 'turn:a.test:80', TURN_USERNAME: 'u' }), []);
});

test('the server config uses NON-VITE variable names', () => {
  // A VITE_-prefixed name would be compiled into the public bundle again,
  // which is the exact bug this replaces.
  const fn = staticTurnFromEnv.toString();
  assert.equal(/VITE_/.test(fn), false, 'server code must never read VITE_ vars');
});

test('the Metered URL is built only when both settings exist', () => {
  assert.equal(meteredCredentialsUrl({}), null);
  assert.equal(meteredCredentialsUrl({ METERED_APP_NAME: 'x' }), null);
  const url = meteredCredentialsUrl({ METERED_APP_NAME: 'buddy', METERED_API_KEY: 'k e y/+' });
  assert.ok(url.startsWith('https://buddy.metered.live/api/v1/turn/credentials?apiKey='));
  assert.ok(!url.includes(' '), 'the api key must be url-encoded');
});

test('STUN is always available as a floor', () => {
  assert.ok(STUN_ONLY.length >= 1);
  assert.ok(STUN_ONLY.every((s) => s.urls.startsWith('stun:')));
  assert.ok(STUN_ONLY.every((s) => !('credential' in s)));
});

test('rate limiting allows a normal burst then blocks', () => {
  const store = new Map();
  for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
    assert.equal(rateLimit(store, 'uid', NOW + i).allowed, true, `request ${i}`);
  }
  const blocked = rateLimit(store, 'uid', NOW + RATE_LIMIT_MAX);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter >= 1);
});

test('the window slides, so a limited user recovers', () => {
  const store = new Map();
  for (let i = 0; i < RATE_LIMIT_MAX; i += 1) rateLimit(store, 'uid', NOW);
  assert.equal(rateLimit(store, 'uid', NOW).allowed, false);
  assert.equal(rateLimit(store, 'uid', NOW + RATE_LIMIT_WINDOW_MS + 1).allowed, true);
});

test('one noisy user cannot rate-limit everyone else', () => {
  const store = new Map();
  for (let i = 0; i < RATE_LIMIT_MAX + 5; i += 1) rateLimit(store, 'noisy', NOW);
  assert.equal(rateLimit(store, 'someone-else', NOW).allowed, true);
});

test('the limiter store does not grow without bound', () => {
  const store = new Map();
  for (let i = 0; i < 500; i += 1) rateLimit(store, `uid-${i}`, NOW);
  assert.equal(store.size, 500);
  assert.equal(pruneRateLimitStore(store, NOW + RATE_LIMIT_WINDOW_MS + 1), 0);
});
