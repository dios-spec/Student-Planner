import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_RECORD,
  MAX_ASKS,
  SNOOZE_MS,
  parsePromptRecord,
  shouldAskForPermission,
} from './notificationPermission.ts';

const NOW = 1_800_000_000_000;
const base = { permission: 'default' as const, onboarded: true, record: EMPTY_RECORD, nowMs: NOW };

test('a fresh onboarded user is asked', () => {
  const d = shouldAskForPermission(base);
  assert.equal(d.show, true);
  assert.equal(d.reason, 'ask');
});

test('never during onboarding', () => {
  assert.deepEqual(shouldAskForPermission({ ...base, onboarded: false }), {
    show: false, reason: 'not-onboarded',
  });
});

test('never when already granted', () => {
  assert.equal(shouldAskForPermission({ ...base, permission: 'granted' }).reason, 'already-granted');
});

test('never after a denial -- the browser will not show the dialog again', () => {
  // Asking anyway would be a dead end for the user and pure nagging.
  assert.equal(shouldAskForPermission({ ...base, permission: 'denied' }).show, false);
  assert.equal(shouldAskForPermission({ ...base, permission: 'denied' }).reason, 'denied');
});

test('never where notifications are not supported at all', () => {
  assert.equal(shouldAskForPermission({ ...base, permission: 'unsupported' }).show, false);
});

test('"not now" snoozes rather than dismissing forever', () => {
  const justAsked = { asks: 1, lastAskedAt: NOW - 1000 };
  assert.equal(shouldAskForPermission({ ...base, record: justAsked }).reason, 'snoozed');

  const longAgo = { asks: 1, lastAskedAt: NOW - SNOOZE_MS - 1 };
  assert.equal(shouldAskForPermission({ ...base, record: longAgo }).show, true);
});

test('but we stop asking after a few refusals', () => {
  const worn = { asks: MAX_ASKS, lastAskedAt: NOW - 10 * SNOOZE_MS };
  assert.equal(shouldAskForPermission({ ...base, record: worn }).reason, 'asked-too-often');
});

test('the old v1 permanent-dismissal flag becomes one ask, not a life sentence', () => {
  const migrated = parsePromptRecord('1');
  assert.equal(migrated.asks, 1);
  assert.equal(migrated.lastAskedAt, 0);
  // lastAskedAt 0 means no snooze is in force, so an existing user who
  // dismissed once under the old build can be asked once more.
  assert.equal(shouldAskForPermission({ ...base, record: migrated }).show, true);
});

test('corrupt or missing storage never blocks or crashes the prompt', () => {
  assert.deepEqual(parsePromptRecord(null), EMPTY_RECORD);
  assert.deepEqual(parsePromptRecord('not json'), EMPTY_RECORD);
  assert.deepEqual(parsePromptRecord('{"asks":"x"}'), EMPTY_RECORD);
});

test('a well-formed record round-trips', () => {
  const r = parsePromptRecord(JSON.stringify({ asks: 2, lastAskedAt: NOW }));
  assert.deepEqual(r, { asks: 2, lastAskedAt: NOW });
});
