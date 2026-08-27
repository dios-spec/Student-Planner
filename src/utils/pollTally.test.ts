import assert from 'node:assert/strict';
import test from 'node:test';
import { tallyPoll } from './pollTally.ts';

test('single-select shares sum to 100', () => {
  const t = tallyPoll([{ id: 'a', votes: ['u1', 'u2'] }, { id: 'b', votes: ['u3'] }], false);
  assert.equal(t.voters, 3);
  assert.equal(t.selections, 3);
  assert.deepEqual(t.options.map((o) => o.pct), [67, 33]);
  assert.equal(t.summary, '3 votes');
});

test('multi-select: no individual bar exceeds 100 even though shares sum past it', () => {
  // One person picked both options -- the case reported as ">100%".
  const t = tallyPoll([{ id: 'a', votes: ['u1'] }, { id: 'b', votes: ['u1'] }], true);
  assert.equal(t.voters, 1);
  assert.equal(t.selections, 2);
  assert.deepEqual(t.options.map((o) => o.pct), [100, 100]);
  assert.ok(t.options.every((o) => o.pct <= 100));
  // The label is the actual fix: "1 voter", not "1 vote".
  assert.equal(t.summary, '1 voter');
});

test('multi-select summary counts people, not selections', () => {
  const t = tallyPoll(
    [{ id: 'a', votes: ['u1', 'u2', 'u3'] }, { id: 'b', votes: ['u1', 'u2'] }, { id: 'c', votes: ['u1'] }],
    true
  );
  assert.equal(t.voters, 3);
  assert.equal(t.selections, 6);
  assert.equal(t.summary, '3 voters');
});

test('a duplicated uid from a console edit cannot push a bar over 100', () => {
  const t = tallyPoll([{ id: 'a', votes: ['u1', 'u1', 'u1'] }], false);
  assert.equal(t.voters, 1);
  assert.equal(t.options[0].count, 1);
  assert.equal(t.options[0].pct, 100);
});

test('a poll with no votes yet renders zeroes, not NaN', () => {
  const t = tallyPoll([{ id: 'a', votes: [] }, { id: 'b' }], false);
  assert.deepEqual(t.options.map((o) => o.pct), [0, 0]);
  assert.equal(t.summary, '0 votes');
});

test('missing options do not throw', () => {
  const t = tallyPoll(undefined, false);
  assert.equal(t.voters, 0);
  assert.deepEqual(t.options, []);
});

test('singular and plural wording', () => {
  assert.equal(tallyPoll([{ id: 'a', votes: ['u1'] }], false).summary, '1 vote');
  assert.equal(tallyPoll([{ id: 'a', votes: ['u1', 'u2'] }], false).summary, '2 votes');
  assert.equal(tallyPoll([{ id: 'a', votes: ['u1'] }], true).summary, '1 voter');
});
