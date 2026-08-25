import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// static pseudo-waveform bars — decorative, consistent per message
const BARS = [8, 14, 20, 12, 24, 16, 28, 18, 10, 22, 14, 26, 12, 20, 16, 24, 10, 18];

export default function VoicePlayer({
  url,
  duration,
  mine,
}: {
  url: string;
  duration?: number;
  mine?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      if (isFinite(audio.duration)) setTotal(audio.duration);
    };
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
      // BUG-27: stop playback on unmount, otherwise a voice note keeps playing
      // after the chat screen closes with no way to stop it.
      try { audio.pause(); } catch { /* ignore */ }
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  const progress = total ? current / total : 0;
  const accent = mine ? 'bg-white' : 'bg-accent';
  const dim = mine ? 'bg-white/40' : 'bg-ink-soft/30';

  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          mine ? 'bg-white/20 text-white' : 'bg-accent/15 text-accent'
        }`}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-0.5" />}
      </button>
      <div className="flex items-center gap-[3px]">
        {BARS.map((h, i) => {
          const filled = i / BARS.length <= progress;
          return (
            <span
              key={i}
              className={`w-[3px] rounded-full ${filled ? accent : dim}`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <span className={`text-xs ${mine ? 'text-white/80' : 'text-ink-soft'}`}>
        {fmt(playing || current ? current : total)}
      </span>
    </div>
  );
}
