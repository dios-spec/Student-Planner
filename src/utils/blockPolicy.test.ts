import assert from 'node:assert/strict';
import test from 'node:test';
import { dmPeerOf, isBlockedPair, interactionStateFor } from './blockPolicy.ts';

const ME = 'uid_me';
const THEM = 'uid_them';
const none = new Set<string>();

test('dmPeerOf returns the other member regardless of order', () => {
  assert.equal(dmPeerOf([ME, THEM], ME), THEM);
  assert.equal(dmPeerOf([THEM, ME], ME), THEM);
});

test('dmPeerOf refuses anything that is not a well-formed 2-person DM', () => {
  assert.equal(dmPeerOf([ME], ME), null);
  assert.equal(dmPeerOf([ME, THEM, 'uid_third'], ME), null);
  assert.equal(dmPeerOf(undefined, ME), null);
  // Not a member at all -- must not silently pick a peer.
  assert.equal(dmPeerOf(['uid_a', 'uid_b'], ME), null);
});

test('blocking is symmetric: either direction closes the channel', () => {
  assert.equal(isBlockedPair(THEM, new Set([THEM]), none), true, 'I blocked them');
  assert.equal(isBlockedPair(THEM, none, new Set([THEM])), true, 'they blocked me');
  assert.equal(isBlockedPair(THEM, new Set([THEM]), new Set([THEM])), true, 'both');
  assert.equal(isBlockedPair(THEM, none, none), false, 'neither');
});

test('an unrelated block does not close this channel', () => {
  assert.equal(isBlockedPair(THEM, new Set(['uid_other']), new Set(['uid_other2'])), false);
});

test('state is loading until the block lists have actually arrived', () => {
  // This is the regression the fix is about: before the block snapshots land
  // we must NOT report an open channel.
  assert.equal(interactionStateFor(THEM, false, none, none), 'loading');
  assert.equal(interactionStateFor(THEM, false, new Set([THEM]), none), 'loading');
});

test('state resolves once loaded', () => {
  assert.equal(interactionStateFor(THEM, true, none, none), 'open');
  assert.equal(interactionStateFor(THEM, true, new Set([THEM]), none), 'blocked');
  assert.equal(interactionStateFor(THEM, true, none, new Set([THEM])), 'blocked');
});

test('groups have no peer and are never gated', () => {
  assert.equal(interactionStateFor(null, false, none, none), 'open');
  assert.equal(interactionStateFor(null, true, new Set([THEM]), none), 'open');
});
