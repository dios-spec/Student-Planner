import { useCallback, useEffect, useRef, useState } from 'react';

interface RecorderState {
  recording: boolean;
  seconds: number;
  error: string | null;
}

const MAX_SECONDS = 120; // cap voice notes at 2 min to protect Cloudinary quota

/** Microphone recorder using MediaRecorder. Requests permission only on start. */
export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>({ recording: false, seconds: 0, error: null });
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);
  // Holds a finished recording that nobody was waiting for yet -- specifically
  // the one produced when the 2-minute cap stops the recorder on its own.
  const pendingBlobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
  }, []);

  // BUG-26: release the microphone if the component unmounts mid-recording.
  // Without this the mic stream stays open for the rest of the session.
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        mediaRef.current.onstop = null;
        try { mediaRef.current.stop(); } catch { /* already stopped */ }
      }
      resolveRef.current = null;
      cleanupRef.current();
    };
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState((s) => ({ ...s, error: 'Voice recording not supported on this browser.' }));
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      // pick a mime type the browser actually supports
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        cleanup();
        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        } else {
          // Hitting MAX_SECONDS stops the recorder before the user pressed
          // Send, so resolveRef is still null. The old code dropped the blob on
          // the floor here and left `recording: true`, so the bar froze at 2:00
          // and pressing Send afterwards returned null -- the entire two-minute
          // recording was silently lost. Keep it for the next stop() instead.
          pendingBlobRef.current = blob;
        }
        setState((s) => ({ ...s, recording: false }));
      };
      pendingBlobRef.current = null;
      startedAtRef.current = Date.now();
      mr.start();
      setState({ recording: true, seconds: 0, error: null });
      timerRef.current = window.setInterval(() => {
        // The cap check used to live inside a setState updater. React may run
        // an updater more than once (StrictMode, discarded concurrent renders),
        // and stopInternal() is a side effect -- it does not belong there.
        const elapsed = Math.min(
          MAX_SECONDS,
          Math.floor((Date.now() - startedAtRef.current) / 1000)
        );
        setState((s) => (s.seconds === elapsed ? s : { ...s, seconds: elapsed }));
        if (elapsed >= MAX_SECONDS) stopInternal();
      }, 1000);
      return true;
    } catch {
      setState((s) => ({ ...s, error: 'Microphone permission denied.' }));
      cleanup();
      return false;
    }
  }, [cleanup]);

  function stopInternal() {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  }

  /** Stops and resolves with the recorded blob (and duration). */
  const stop = useCallback((): Promise<{ blob: Blob | null; duration: number }> => {
    return new Promise((resolve) => {
      const duration = state.seconds;
      if (!mediaRef.current || mediaRef.current.state === 'inactive') {
        // May be a recording the 2-minute cap already finished for us.
        const pending = pendingBlobRef.current;
        pendingBlobRef.current = null;
        resolve({ blob: pending, duration });
        setState((s) => ({ ...s, recording: false }));
        return;
      }
      resolveRef.current = (blob) => resolve({ blob, duration });
      stopInternal();
      setState((s) => ({ ...s, recording: false }));
    });
  }, [state.seconds]);

  /** Cancels recording and discards the audio. */
  const cancel = useCallback(() => {
    resolveRef.current = null;
    pendingBlobRef.current = null;
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.onstop = () => cleanup();
      mediaRef.current.stop();
    } else {
      cleanup();
    }
    setState({ recording: false, seconds: 0, error: null });
  }, [cleanup]);

  return { ...state, start, stop, cancel };
}
