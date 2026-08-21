let ctx: AudioContext | null = null;
let interval: number | null = null;

function audioCtor() {
  return window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
}

/** Call this from a real user gesture once so later incoming calls can ring. */
export function primeRingtone() {
  try {
    if (!ctx || ctx.state === 'closed') {
      const Ctor = audioCtor();
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  } catch {
    // Web Audio unsupported.
  }
}

function playBurst() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;

  [0, 0.42].forEach((offset) => {
    const oscA = ctx!.createOscillator();
    const oscB = ctx!.createOscillator();
    const gain = ctx!.createGain();

    oscA.frequency.value = 440;
    oscB.frequency.value = 520;
    oscA.type = 'sine';
    oscB.type = 'sine';

    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.04);
    gain.gain.linearRampToValueAtTime(0, now + offset + 0.32);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(ctx!.destination);

    oscA.start(now + offset);
    oscB.start(now + offset);
    oscA.stop(now + offset + 0.34);
    oscB.stop(now + offset + 0.34);
  });
}

export function startRingtone() {
  stopRingtone();
  primeRingtone();

  try {
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
    playBurst();
    interval = window.setInterval(playBurst, 2100);
    navigator.vibrate?.([700, 250, 700, 250, 900]);
  } catch {
    // Audio/vibration unavailable.
  }
}

export function stopRingtone() {
  if (interval !== null) {
    clearInterval(interval);
    interval = null;
  }
  navigator.vibrate?.(0);
}
