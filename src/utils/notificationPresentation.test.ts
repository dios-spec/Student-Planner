import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

/**
 * public/notification-presentation.js is a classic script shared with the
 * service worker (importScripts cannot load ES modules), so it is loaded here
 * the same way the worker loads it: into a context with a `self` global.
 */
interface Presentation {
  dismiss: boolean;
  tag?: string;
  title?: string;
  options?: {
    body: string;
    icon: string;
    badge: string;
    tag: string;
    renotify: boolean;
    requireInteraction: boolean;
    vibrate: number[];
    data: Record<string, string>;
    actions: { action: string; title: string }[];
  };
}

interface Api {
  presentation: (d: Record<string, string>, origin: string) => Presentation;
  tagFor: (d: Record<string, string>) => string;
  safeRoute: (route: string, origin: string) => string;
}

const ORIGIN = 'https://student-collab-7th.vercel.app';

function load(): Api {
  const ctx: Record<string, unknown> = { URL };
  ctx.self = ctx;
  createContext(ctx);
  runInContext(readFileSync('public/notification-presentation.js', 'utf8'), ctx);
  return (ctx as { BuddyNotification: Api }).BuddyNotification;
}

const api = load();

test('a ringing call and its missed-call follow-up share one tag', () => {
  // This is what lets the missed notification REPLACE the ringing one instead
  // of leaving a dead "incoming call" on the lock screen forever.
  const ringing = api.tagFor({ type: 'incomingCall', callId: 'c1', notificationId: 'n1' });
  const missed = api.tagFor({ type: 'missedCall', callId: 'c1', notificationId: 'n2' });
  assert.equal(ringing, 'call-c1');
  assert.equal(missed, ringing);
});

test('the old dead call-tag branch is really fixed', () => {
  // Previously: tag = notificationId || (isCall ? `call-${callId}` : undefined).
  // notificationId is always sent, so the call branch never ran and each ring
  // stacked a new, uncloseable notification.
  const tag = api.tagFor({ type: 'incomingCall', callId: 'c1', notificationId: 'n1' });
  assert.notEqual(tag, 'n1');
});

test('two rings of the same call collapse; different calls do not', () => {
  assert.equal(
    api.tagFor({ type: 'incomingCall', callId: 'c1', notificationId: 'n1' }),
    api.tagFor({ type: 'incomingCall', callId: 'c1', notificationId: 'n9' })
  );
  assert.notEqual(
    api.tagFor({ type: 'incomingCall', callId: 'c1' }),
    api.tagFor({ type: 'incomingCall', callId: 'c2' })
  );
});

test('chat messages group per conversation, not per message', () => {
  assert.equal(
    api.tagFor({ type: 'dm', conversationId: 'a__b', notificationId: 'n1' }),
    api.tagFor({ type: 'dm', conversationId: 'a__b', notificationId: 'n2' })
  );
  assert.notEqual(
    api.tagFor({ type: 'dm', conversationId: 'a__b' }),
    api.tagFor({ type: 'dm', conversationId: 'c__d' })
  );
});

test('unrelated notifications stay separate', () => {
  assert.equal(api.tagFor({ type: 'homework', notificationId: 'n1' }), 'n1');
  assert.notEqual(
    api.tagFor({ type: 'homework', notificationId: 'n1' }),
    api.tagFor({ type: 'homework', notificationId: 'n2' })
  );
});

test('callEnded is a control payload that displays nothing', () => {
  const p = api.presentation({ type: 'callEnded', callId: 'c1' }, ORIGIN);
  assert.equal(p.dismiss, true);
  assert.equal(p.tag, 'call-c1');
  assert.equal(p.options, undefined, 'must not render a notification');
});

test('a ringing call is sticky, buzzes, and offers Accept/Decline', () => {
  const p = api.presentation(
    { type: 'incomingCall', callId: 'c1', title: 'Asha', body: 'Incoming voice call' },
    ORIGIN
  );
  assert.equal(p.dismiss, false);
  assert.equal(p.options?.requireInteraction, true);
  assert.equal(p.options?.renotify, true);
  assert.deepEqual(Array.from(p.options?.actions ?? [], (a) => a.action), ['accept', 'decline']);
  assert.ok((p.options?.vibrate.length ?? 0) > 3);
});

test('an ordinary notification is not sticky and has no actions', () => {
  const p = api.presentation({ type: 'homework', title: 'New homework', notificationId: 'n1' }, ORIGIN);
  assert.equal(p.options?.requireInteraction, false);
  assert.equal(Array.from(p.options?.actions ?? []).length, 0);
});

test('lock-screen text is capped so a long message cannot spill in full', () => {
  const p = api.presentation({ type: 'dm', title: 'x'.repeat(200), body: 'y'.repeat(500) }, ORIGIN);
  assert.ok((p.options?.body.length ?? 0) <= 140);
  assert.ok((p.title?.length ?? 0) <= 60);
  assert.ok(p.options?.body.endsWith('…'));
});

test('short text is left exactly alone', () => {
  const p = api.presentation({ type: 'dm', title: 'Asha', body: 'see you at 4' }, ORIGIN);
  assert.equal(p.title, 'Asha');
  assert.equal(p.options?.body, 'see you at 4');
});

test('a missing title falls back rather than rendering "undefined"', () => {
  assert.equal(api.presentation({ type: 'homework' }, ORIGIN).title, 'Buddy Planner');
});

test('routes are forced same-origin AND onto a route that exists', () => {
  assert.equal(api.safeRoute('/messages?open=abc', ORIGIN), '/messages?open=abc');
  assert.equal(api.safeRoute('/settings/notifications', ORIGIN), '/settings/notifications');
  assert.equal(api.safeRoute('https://evil.test/steal', ORIGIN), '/', 'off-origin');
  assert.equal(api.safeRoute('', ORIGIN), '/');
  // Same-origin but not a registered route: opening it would render a blank
  // screen, so the app root is the better landing place.
  assert.equal(api.safeRoute('not a url ://', ORIGIN), '/');
  assert.equal(api.safeRoute('/no-such-page', ORIGIN), '/');
});

test('the Phase 1 DM deep link survives into the notification data', () => {
  const p = api.presentation(
    { type: 'dm', route: '/messages?open=a__b', conversationId: 'a__b', title: 'Asha' },
    ORIGIN
  );
  assert.equal(p.options?.data.route, '/messages?open=a__b');
});

test('an off-origin route is neutralised before it reaches the click handler', () => {
  const p = api.presentation({ type: 'dm', route: 'https://evil.test/x', title: 'Asha' }, ORIGIN);
  assert.equal(p.options?.data.route, '/');
});
