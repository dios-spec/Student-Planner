import { useEffect, useRef } from 'react';

const THROTTLE_MS = 3000;
const CLEAR_AFTER_MS = 5000;

export function useTypingThrottle(setTyping: (isTyping: boolean) => void) {
  const lastSentRef = useRef(0);
  const clearTimerRef = useRef<number | null>(null);
  const typingRef = useRef(false);
  const setTypingRef = useRef(setTyping);
  setTypingRef.current = setTyping;

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      if (typingRef.current) setTypingRef.current(false);
    };
  }, []);

  return function notifyTyping() {
    const now = Date.now();
    if (!typingRef.current || now - lastSentRef.current > THROTTLE_MS) {
      lastSentRef.current = now;
      typingRef.current = true;
      setTypingRef.current(true);
    }
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      typingRef.current = false;
      setTypingRef.current(false);
    }, CLEAR_AFTER_MS);
  };
}
