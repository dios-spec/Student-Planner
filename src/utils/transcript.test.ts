import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeLive, mergeOlder } from './transcript.ts';

interface Msg { id: string; createdAt: { toMillis: () => number } | null }
const m = (id: string, ms: number): Msg => ({ id, createdAt: { toMillis: () => ms } });
const ids = (list: Msg[]) => list.map((x) => x.id).join(',');

test('the sliding-window gap is closed', () => {
  // Live window holds 3 at a time.
  let archive: Msg[] = [];
  archive = mergeLive(archive, [m('m4', 4), m('m5', 5), m('m6', 6)]);
  // Reader loads an older page.
  archive = mergeOlder(archive, [m('m1', 1), m('m2', 2), m('m3', 3)]);
  assert.equal(ids(archive), 'm1,m2,m3,m4,m5,m6');

  // Three new messages arrive; 4-6 fall out of the live window entirely.
  archive = mergeLive(archive, [m('m7', 7), m('m8', 8), m('m9', 9)]);

  // The old concatenation would have produced m1,m2,m3,m7,m8,m9 here.
  assert.equal(ids(archive), 'm1,m2,m3,m4,m5,m6,m7,m8,m9');
});

test('the live snapshot supersedes an older copy of the same message', () => {
  const stale = { id: 'm1', createdAt: { toMillis: () => 1 }, text: 'old' };
  const fresh = { id: 'm1', createdAt: { toMillis: () => 1 }, text: 'edited' };
  const out = mergeLive([stale], [fresh]);
  assert.equal(out.length, 1);
  assert.equal((out[0] as typeof fresh).text, 'edited');
});

test('a hard delete inside the live window is dropped', () => {
  let archive = mergeLive([], [m('a', 1), m('b', 2), m('c', 3)]);
  archive = mergeLive(archive, [m('a', 1), m('c', 3)]);
  assert.equal(ids(archive), 'a,c');
});

test('history outside the live window is never pruned', () => {
  let archive = mergeOlder([], [m('old1', 1), m('old2', 2)]);
  archive = mergeLive(archive, [m('new1', 50), m('new2', 51)]);
  assert.equal(ids(archive), 'old1,old2,new1,new2');
});

test('an empty live snapshot does not wipe the transcript', () => {
  const archive = mergeOlder([], [m('a', 1)]);
  assert.equal(ids(mergeLive(archive, [])), 'a');
});

test('older pages de-duplicate against what is already held', () => {
  const archive = mergeLive([], [m('a', 1), m('b', 2)]);
  assert.equal(ids(mergeOlder(archive, [m('a', 1), m('z', 0)])), 'z,a,b');
});

test('a message still awaiting its server timestamp sorts last', () => {
  const pending: Msg = { id: 'pending', createdAt: null };
  const out = mergeLive([], [m('a', 1), pending, m('b', 2)]);
  assert.equal(ids(out), 'a,b,pending');
});

test('identical timestamps produce a deterministic order', () => {
  const a = mergeLive([], [m('b', 5), m('a', 5)]);
  const b = mergeLive([], [m('a', 5), m('b', 5)]);
  assert.equal(ids(a), ids(b));
});
