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
        resolveRef.current?.(blob);
        resolveRef.current = null;
      };
      mr.start();
      setState({ recording: true, seconds: 0, error: null });
      timerRef.current = window.setInterval(() => {
        setState((s) => {
          const next = s.seconds + 1;
          if (next >= MAX_SECONDS) stopInternal();
          return { ...s, seconds: next };
        });
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
        resolve({ blob: null, duration });
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
