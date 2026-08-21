// Simple looping ringtone using the Web Audio API — no audio file needed.
let ctx: AudioContext | null = null;
let interval: number | null = null;

export function startRingtone() {
  stopRingtone();
  try {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const play = () => {
      if (!ctx) return;
      const now = ctx.currentTime;
      [0, 0.4].forEach((offset) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.frequency.value = 480;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.15, now + offset + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + offset + 0.3);
        osc.connect(gain);
        gain.connect(ctx!.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.3);
      });
    };
    play();
    interval = window.setInterval(play, 2000);
  } catch { /* audio not available */ }
}

export function stopRingtone() {
  if (interval) { clearInterval(interval); interval = null; }
  if (ctx) { ctx.close().catch(() => {}); ctx = null; }
}
