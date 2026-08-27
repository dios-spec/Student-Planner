import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEVICE_TTL_DAYS,
  MAX_DEVICES,
  REFRESH_AFTER_MS,
  deviceLabel,
  nextDeviceState,
} from './pushDevices.ts';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

test('a first registration stores exactly one device', () => {
  const s = nextDeviceState(null, 'tok-a', NOW, 'Android Chrome');
  assert.deepEqual(s.fcmTokens, ['tok-a']);
  assert.equal(s.fcmToken, 'tok-a');
  assert.equal(s.devices[0].updatedAt, NOW);
  assert.equal(s.devices[0].label, 'Android Chrome');
  assert.equal(s.changed, true);
});

test('one user keeps several real devices', () => {
  let doc = nextDeviceState(null, 'phone', NOW - 2 * DAY);
  doc = nextDeviceState(doc, 'laptop', NOW - DAY);
  const s = nextDeviceState(doc, 'tablet', NOW);
  assert.deepEqual(s.fcmTokens, ['tablet', 'laptop', 'phone'], 'newest first');
});

test('re-registering the same device does not duplicate it', () => {
  let doc = nextDeviceState(null, 'phone', NOW - 30 * DAY);
  doc = nextDeviceState(doc, 'phone', NOW);
  assert.deepEqual(doc.fcmTokens, ['phone']);
  assert.equal(doc.devices.length, 1);
});

test('token rotation cannot grow the list without bound', () => {
  // The old bug: arrayUnion + a hard rules cap meant that after enough
  // rotations every write was rejected and push died permanently.
  let doc = nextDeviceState(null, 'rot-0', NOW - 40 * DAY);
  for (let i = 1; i <= 40; i += 1) {
    doc = nextDeviceState(doc, `rot-${i}`, NOW - 40 * DAY + i * 1000);
  }
  assert.ok(doc.devices.length <= MAX_DEVICES, `bounded, got ${doc.devices.length}`);
  assert.equal(doc.fcmTokens.length, doc.devices.length);
  assert.equal(doc.fcmTokens[0], 'rot-40', 'newest token survives');
});

test('the newest token always survives the cap', () => {
  let doc = nextDeviceState(null, 'old-0', NOW - 10 * DAY);
  for (let i = 1; i < MAX_DEVICES; i += 1) doc = nextDeviceState(doc, `old-${i}`, NOW - 10 * DAY + i);
  const s = nextDeviceState(doc, 'brand-new', NOW);
  assert.equal(s.fcmTokens.length, MAX_DEVICES);
  assert.ok(s.fcmTokens.includes('brand-new'));
  assert.equal(s.fcmToken, 'brand-new');
});

test('devices untouched past the TTL are pruned', () => {
  const stale = { devices: [{ token: 'ancient', updatedAt: NOW - (DEVICE_TTL_DAYS + 5) * DAY }] };
  const s = nextDeviceState(stale, 'current', NOW);
  assert.deepEqual(s.fcmTokens, ['current']);
});

test('a device just inside the TTL is kept', () => {
  const recent = { devices: [{ token: 'keeper', updatedAt: NOW - (DEVICE_TTL_DAYS - 1) * DAY }] };
  const s = nextDeviceState(recent, 'current', NOW);
  assert.ok(s.fcmTokens.includes('keeper'));
});

test('a legacy fcmTokens-only document migrates without losing tokens', () => {
  const legacy = { fcmToken: 'b', fcmTokens: ['a', 'b'] };
  const s = nextDeviceState(legacy, 'b', NOW);
  assert.ok(s.fcmTokens.includes('a'), 'must not drop a working device on migration');
  assert.ok(s.fcmTokens.includes('b'));
  assert.equal(s.devices.every((d) => d.updatedAt === NOW), true, 'unknown age gets a grace stamp');
});

test('registration is idempotent: an unchanged recent device writes nothing', () => {
  const first = nextDeviceState(null, 'tok', NOW);
  const again = nextDeviceState(first, 'tok', NOW + 60_000);
  assert.equal(again.changed, false, 'no Firestore write on every app open');
});

test('but it does re-stamp once the refresh window has passed', () => {
  const first = nextDeviceState(null, 'tok', NOW);
  const later = nextDeviceState(first, 'tok', NOW + REFRESH_AFTER_MS + 1);
  assert.equal(later.changed, true);
  assert.equal(later.devices[0].updatedAt, NOW + REFRESH_AFTER_MS + 1);
});

test('a new device on an existing account is always a change', () => {
  const first = nextDeviceState(null, 'phone', NOW);
  assert.equal(nextDeviceState(first, 'laptop', NOW + 1000).changed, true);
});

test('malformed stored entries are ignored, not crashed on', () => {
  const junk = { devices: [null, { updatedAt: NOW }, { token: '' }, { token: 'ok', updatedAt: NOW }] };
  const s = nextDeviceState(junk as never, 'current', NOW);
  assert.deepEqual(s.fcmTokens.sort(), ['current', 'ok']);
});

test('an entry with a missing timestamp is not treated as ancient', () => {
  const s = nextDeviceState({ devices: [{ token: 'x' }] } as never, 'current', NOW);
  assert.ok(s.fcmTokens.includes('x'));
});

test('fcmTokens always mirrors devices exactly', () => {
  let doc = nextDeviceState(null, 't0', NOW - 5 * DAY);
  for (let i = 1; i < 15; i += 1) doc = nextDeviceState(doc, `t${i}`, NOW - 5 * DAY + i * 1000);
  assert.deepEqual(doc.fcmTokens, doc.devices.map((d) => d.token));
});

test('device labels are coarse and non-identifying', () => {
  assert.equal(deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/120'), 'Android Chrome');
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone) Safari'), 'iOS Browser');
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120'), 'Windows Chrome');
  assert.equal(deviceLabel(undefined), 'Device Browser');
});
