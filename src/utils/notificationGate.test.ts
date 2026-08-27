import assert from 'node:assert/strict';
import test from 'node:test';
import { checkNotificationAllowed, isWithinQuietHours } from './notificationGate.ts';
// The real server module. If the two implementations ever drift, the
// cross-check test below fails rather than a student silently getting buzzed
// at 1am by a path the server thought it had suppressed.
import { checkPushAllowed } from '../../api/_lib/notificationGate.js';

const at = (iso: string) => new Date(iso);

test('quiet hours that wrap midnight cover both sides of it', () => {
  // 22:00 -> 07:00 UTC
  assert.equal(isWithinQuietHours(at('2026-03-01T23:30:00Z'), 'UTC', '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours(at('2026-03-01T02:00:00Z'), 'UTC', '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours(at('2026-03-01T12:00:00Z'), 'UTC', '22:00', '07:00'), false);
});

test('quiet hours inside a single day do not wrap', () => {
  assert.equal(isWithinQuietHours(at('2026-03-01T10:00:00Z'), 'UTC', '09:00', '17:00'), true);
  assert.equal(isWithinQuietHours(at('2026-03-01T18:00:00Z'), 'UTC', '09:00', '17:00'), false);
});

test('boundaries: start is inclusive, end is exclusive', () => {
  assert.equal(isWithinQuietHours(at('2026-03-01T22:00:00Z'), 'UTC', '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours(at('2026-03-01T07:00:00Z'), 'UTC', '22:00', '07:00'), false);
});

test('start == end means quiet hours are off, not always-on', () => {
  assert.equal(isWithinQuietHours(at('2026-03-01T03:00:00Z'), 'UTC', '22:00', '22:00'), false);
});

test('the window follows the user timezone, not the server clock', () => {
  // 20:00 UTC is 01:30 next day in Asia/Calcutta -- inside 22:00-07:00 there,
  // but outside it in UTC.
  const utcMidEvening = at('2026-03-01T20:00:00Z');
  assert.equal(isWithinQuietHours(utcMidEvening, 'Asia/Calcutta', '22:00', '07:00'), true);
  assert.equal(isWithinQuietHours(utcMidEvening, 'UTC', '22:00', '07:00'), false);
});

test('a garbage timezone falls back to UTC instead of throwing', () => {
  assert.equal(isWithinQuietHours(at('2026-03-01T23:30:00Z'), 'Not/AZone', '22:00', '07:00'), true);
});

test('a muted category is blocked regardless of the hour', () => {
  const user = { notificationSettings: { dm: false } };
  assert.equal(checkNotificationAllowed(user, 'dm', at('2026-03-01T12:00:00Z')).allowed, false);
});

test('an unknown type has no toggle and is always allowed', () => {
  assert.equal(checkNotificationAllowed({}, 'somethingNew', at('2026-03-01T12:00:00Z')).allowed, true);
});

test('calls and urgent school alerts can pierce quiet hours when permitted', () => {
  const now = at('2026-03-01T23:30:00Z');
  const qh = { enabled: true, start: '22:00', end: '07:00', allowCalls: true, allowUrgent: true };
  const user = { timezone: 'UTC', notificationSettings: { quietHours: qh } };

  assert.equal(checkNotificationAllowed(user, 'incomingCall', now).allowed, true);
  assert.equal(checkNotificationAllowed(user, 'homework', now).allowed, true);
  assert.equal(checkNotificationAllowed(user, 'dm', now).allowed, false);
  assert.equal(checkNotificationAllowed(user, 'dm', now).reason, 'quiet-hours');
});

test('and are blocked when the bypasses are off', () => {
  const now = at('2026-03-01T23:30:00Z');
  const qh = { enabled: true, start: '22:00', end: '07:00', allowCalls: false, allowUrgent: false };
  const user = { timezone: 'UTC', notificationSettings: { quietHours: qh } };
  assert.equal(checkNotificationAllowed(user, 'incomingCall', now).allowed, false);
  assert.equal(checkNotificationAllowed(user, 'homework', now).allowed, false);
});

test('a brand new user with no settings at all receives everything', () => {
  const now = at('2026-03-01T23:30:00Z');
  for (const type of ['dm', 'incomingCall', 'homework', 'announcement', 'postLike']) {
    assert.equal(checkNotificationAllowed({}, type, now).allowed, true, type);
    assert.equal(checkNotificationAllowed({ notificationSettings: null }, type, now).allowed, true, type);
  }
});

test('malformed settings do not throw or silently block everything', () => {
  const now = at('2026-03-01T23:30:00Z');
  const weird = { notificationSettings: { quietHours: { enabled: true } } };
  assert.doesNotThrow(() => checkNotificationAllowed(weird, 'dm', now));
  // Defaults are 22:00-07:00, so 23:30 is inside.
  assert.equal(checkNotificationAllowed(weird, 'dm', now).allowed, false);
});

test('CLIENT AND SERVER GATES AGREE on every combination', () => {
  const types = [
    'dm', 'groupMessage', 'classMessage', 'reply', 'comment', 'postLike',
    'reelLike', 'storyLike', 'incomingCall', 'missedCall', 'homework', 'exam',
    'announcement', 'studyHelp', 'groupInvite', 'adminPromote', 'addedToGroup',
    'storyNew', 'classReaction',
  ];
  const users = [
    {},
    { notificationSettings: null },
    { notificationSettings: { dm: false, calls: false } },
    { timezone: 'UTC', notificationSettings: { quietHours: { enabled: true, start: '22:00', end: '07:00', allowCalls: true, allowUrgent: true } } },
    { timezone: 'UTC', notificationSettings: { quietHours: { enabled: true, start: '22:00', end: '07:00', allowCalls: false, allowUrgent: false } } },
    { timezone: 'Asia/Calcutta', notificationSettings: { quietHours: { enabled: true, start: '21:00', end: '06:30', allowCalls: true, allowUrgent: false } } },
    { timezone: 'UTC', notificationSettings: { quietHours: { enabled: false, start: '22:00', end: '07:00' } } },
  ];

  let compared = 0;
  for (const user of users) {
    for (const type of types) {
      // The server gate reads new Date() internally, so compare at "now".
      const mine = checkNotificationAllowed(user as never, type);
      const theirs = checkPushAllowed(user, type);
      assert.equal(
        mine.allowed,
        theirs.allowed,
        `disagreement for type=${type} user=${JSON.stringify(user)}`
      );
      if (!mine.allowed) assert.equal(mine.reason, theirs.reason, `reason for ${type}`);
      compared += 1;
    }
  }
  assert.ok(compared > 100, `compared ${compared} combinations`);
});
