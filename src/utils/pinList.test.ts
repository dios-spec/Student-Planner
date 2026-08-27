import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPin, applyUnpin, MAX_PINNED, type PinnedLike } from './pinList.ts';

interface Pin extends PinnedLike { text?: string; pinnedBy?: string; pinnedAt?: unknown }
const at = { seconds: 1 };
const pin = (messageId: string): Pin => ({ messageId, text: messageId, pinnedBy: 'u', pinnedAt: at });

test('pinning appends and reports ok', () => {
  const r = applyPin([pin('a')], { messageId: 'b' }, at);
  assert.equal(r.outcome, 'ok');
  assert.deepEqual(r.next?.map((p) => p.messageId), ['a', 'b']);
});

test('pinning something already pinned is a no-op write', () => {
  const r = applyPin([pin('a')], { messageId: 'a' }, at);
  assert.equal(r.outcome, 'ok');
  assert.equal(r.next, null, 'must not issue a write');
});

test('the cap is enforced and reported', () => {
  const full = Array.from({ length: MAX_PINNED }, (_, i) => pin('m' + i));
  const r = applyPin(full, { messageId: 'extra' }, at);
  assert.equal(r.outcome, 'full');
  assert.equal(r.next, null);
});

test('one below the cap still accepts a pin', () => {
  const nearly = Array.from({ length: MAX_PINNED - 1 }, (_, i) => pin('m' + i));
  const r = applyPin(nearly, { messageId: 'extra' }, at);
  assert.equal(r.outcome, 'ok');
  assert.equal(r.next?.length, MAX_PINNED);
});

test('undefined fields are stripped so Firestore never sees them', () => {
  const r = applyPin([], { messageId: 'a', text: undefined }, at);
  assert.equal(Object.prototype.hasOwnProperty.call(r.next![0], 'text'), false);
});

test('unpin removes the entry', () => {
  assert.deepEqual(applyUnpin([pin('a'), pin('b')], 'a')?.map((p) => p.messageId), ['b']);
});

test('unpinning something absent is a no-op write', () => {
  assert.equal(applyUnpin([pin('a')], 'zzz'), null);
});

test('the input list is never mutated', () => {
  const current = [pin('a')];
  applyPin(current, { messageId: 'b' }, at);
  applyUnpin(current, 'a');
  assert.equal(current.length, 1);
});
