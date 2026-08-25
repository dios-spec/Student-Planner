/**
 * Tiny synthesized sound-effects layer.
 *
 * Deliberately uses the Web Audio API rather than audio files: no assets to
 * host, no Cloudinary quota, no extra network requests, and every sound stays
 * a few hundred bytes of code. Same approach as utils/ringtone.ts.
 *
 * Every sound is short, soft and low-gain on purpose -- this is a school app
 * used in classrooms, so the goal is a subtle tactile "click", never a jingle.
 *
 * Muting: reads the same `notificationSettings.sound` preference the call
 * ringtone respects, via setSfxEnabled() from AuthContext.
 */

let ctx: AudioContext | null = null;
let enabled = true;
let primed = false;

function audioCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/** Called once from a real user gesture so browsers allow audio later. */
export function primeSfx() {
  if (primed) return;
  try {
    const Ctor = audioCtor();
    if (!Ctor) return;
    if (!ctx || ctx.state === 'closed') ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    primed = true;
  } catch {
    // Web Audio unavailable -- all sounds become silent no-ops.
  }
}

/** Mirrors the user's notification sound preference. */
export function setSfxEnabled(next: boolean) {
  enabled = next;
}

/** Short haptic pulse where the device supports it. Safe everywhere. */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported -- ignore
  }
}

interface ToneSpec {
  freq: number;
  /** seconds from now */
  at?: number;
  /** seconds */
  dur?: number;
  /** peak gain, keep well under 0.1 for UI sounds */
  gain?: number;
  type?: OscillatorType;
  /** optional linear glide target */
  slideTo?: number;
}

function play(tones: ToneSpec[]) {
  if (!enabled) return;
  try {
    if (!ctx || ctx.state === 'closed') primeSfx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    for (const t of tones) {
      const start = now + (t.at ?? 0);
      const dur = t.dur ?? 0.08;
      const peak = t.gain ?? 0.05;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = t.type ?? 'sine';
      osc.frequency.setValueAtTime(t.freq, start);
      if (t.slideTo) osc.frequency.linearRampToValueAtTime(t.slideTo, start + dur);

      // Quick attack, smooth decay -- avoids the click of a hard cutoff.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
  } catch {
    // Never let a decorative sound break a real interaction.
  }
}

/** Outgoing message -- soft upward blip. */
export function sfxSend() {
  play([{ freq: 620, slideTo: 880, dur: 0.09, gain: 0.045 }]);
  haptic(10);
}

/** Incoming message while you're looking at the chat -- softer, downward. */
export function sfxReceive() {
  play([{ freq: 760, slideTo: 560, dur: 0.1, gain: 0.035 }]);
}

/** Task ticked off -- a small two-note "done" that feels rewarding. */
export function sfxComplete() {
  play([
    { freq: 660, dur: 0.09, gain: 0.05 },
    { freq: 990, at: 0.075, dur: 0.13, gain: 0.055 },
  ]);
  haptic([14, 30, 18]);
}

/** Reaction / like -- tiny pop. */
export function sfxPop() {
  play([{ freq: 900, slideTo: 1180, dur: 0.06, gain: 0.04, type: 'triangle' }]);
  haptic(8);
}

/** Poll vote / selection confirmed. */
export function sfxSelect() {
  play([{ freq: 520, dur: 0.05, gain: 0.035, type: 'triangle' }]);
  haptic(8);
}

/** Something went wrong -- low, brief, not alarming. */
export function sfxError() {
  play([
    { freq: 300, dur: 0.11, gain: 0.05, type: 'sawtooth' },
    { freq: 220, at: 0.09, dur: 0.14, gain: 0.045, type: 'sawtooth' },
  ]);
  haptic([20, 40, 20]);
}
