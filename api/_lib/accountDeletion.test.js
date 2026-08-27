import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import {
  BATCH_LIMIT,
  DELETION_PLAN,
  RETAINED,
  SPECIAL_CASES,
  anonymisedProfile,
  chunk,
  nextGroupMembership,
  redactedMessage,
} from './accountDeletion.js';

test('EVERY collection the app writes to is accounted for in the deletion plan', () => {
  // Guards against schema drift: add a new collection to the app and forget it
  // here, and this test fails rather than quietly leaving personal data behind.
  const used = new Set();
  for (const file of readdirSync('src/firebase')) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(`src/firebase/${file}`, 'utf8');
    for (const m of source.matchAll(/collection\(db,\s*'([a-zA-Z]+)'/g)) used.add(m[1]);
    for (const m of source.matchAll(/doc\(db,\s*'([a-zA-Z]+)'/g)) used.add(m[1]);
  }

  const planned = new Set(DELETION_PLAN.map((r) => r.collection));
  const special = new Set(SPECIAL_CASES.map((s) => s.split('/')[0]));
  const retained = new Set(RETAINED.flatMap((r) => r.collection.split('/')));

  const unaccounted = [...used].filter(
    (c) => !planned.has(c) && !special.has(c) && !retained.has(c)
  );

  assert.deepEqual(unaccounted, [], `unaccounted collections: ${unaccounted.join(', ')}`);
  assert.ok(used.size >= 15, `sanity: found ${used.size} collections`);
});

test('push tokens are the first thing removed', () => {
  assert.equal(DELETION_PLAN[0].collection, 'pushDevices');
  assert.equal(DELETION_PLAN[0].mode, 'delete');
});

test('conversation history is redacted, never deleted', () => {
  for (const name of ['messages', 'teacherMessages']) {
    const rule = DELETION_PLAN.find((r) => r.collection === name);
    assert.ok(rule, `${name} must be in the plan`);
    assert.equal(rule.mode, 'redact', `${name} must not be hard-deleted from other people's threads`);
  }
});

test('own content is deleted outright', () => {
  for (const name of ['posts', 'reels', 'stories', 'comments']) {
    assert.equal(DELETION_PLAN.find((r) => r.collection === name)?.mode, 'delete', name);
  }
});

test('both directions of blocking are cleared', () => {
  const fields = DELETION_PLAN.filter((r) => r.collection === 'blocks').map((r) => r.match);
  assert.deepEqual(fields.sort(), ['blockedId', 'blockerId']);
});

test('every retained category carries a stated reason', () => {
  for (const item of RETAINED) {
    assert.ok(item.why && item.why.length > 40, `${item.collection} needs a real justification`);
  }
});

test('the anonymised profile keeps no personal content', () => {
  const p = anonymisedProfile('SERVER_TS');
  assert.equal(p.displayName, 'Deleted user');
  for (const field of ['bio', 'avatarUrl', 'emoji', 'mood', 'classId']) {
    assert.equal(p[field], '', `${field} must be cleared`);
  }
  assert.equal(p.accountType, 'deleted');
  assert.equal(p.deletedAt, 'SERVER_TS');
  assert.equal(p.onboarded, false);
});

test('a redacted message keeps no content or authorship', () => {
  const r = redactedMessage('DELETE_SENTINEL');
  assert.equal(r.deleted, true);
  assert.equal(r.text, '');
  assert.equal(r.imageUrl, '');
  assert.equal(r.audioUrl, '', 'voice notes must be cleared too');
  assert.equal(r.senderName, 'Deleted user');
  assert.equal(r.senderAvatar, 'DELETE_SENTINEL');
});

test('leaving a group never leaves it without an admin', () => {
  // The departing user was the only admin.
  const r = nextGroupMembership(['me', 'a', 'b'], ['me'], 'me');
  assert.deepEqual(r.memberIds, ['a', 'b']);
  assert.deepEqual(r.adminIds, ['a'], 'admin must be handed over');
  assert.equal(r.empty, false);
});

test('an existing admin is left in place', () => {
  const r = nextGroupMembership(['me', 'a'], ['me', 'a'], 'me');
  assert.deepEqual(r.adminIds, ['a']);
});

test('a group with nobody left is reported as empty', () => {
  const r = nextGroupMembership(['me'], ['me'], 'me');
  assert.deepEqual(r.memberIds, []);
  assert.equal(r.empty, true);
});

test('a user who was not an admin just leaves', () => {
  const r = nextGroupMembership(['me', 'a'], ['a'], 'me');
  assert.deepEqual(r.memberIds, ['a']);
  assert.deepEqual(r.adminIds, ['a']);
});

test('missing membership arrays do not throw', () => {
  assert.doesNotThrow(() => nextGroupMembership(undefined, undefined, 'me'));
  assert.equal(nextGroupMembership(undefined, undefined, 'me').empty, true);
});

test('batches stay inside the Firestore 500-op limit', () => {
  assert.ok(BATCH_LIMIT < 500);
  const parts = chunk(Array.from({ length: 1000 }, (_, i) => i));
  assert.ok(parts.every((p) => p.length <= BATCH_LIMIT));
  assert.equal(parts.flat().length, 1000, 'nothing dropped');
});
