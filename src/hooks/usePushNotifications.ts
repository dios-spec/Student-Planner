import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export function usePushNotifications() {
  const { user, profile } = useAuth();
  useEffect(() => {
    if (!user || !profile?.onboarded || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let cancelled = false;
    const loadPush = () => {
      void import('../firebase/push').then(({ initPush }) => {
        if (!cancelled) return initPush(user.uid);
      });
    };
    const timer = window.setTimeout(loadPush, 1_500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, profile?.onboarded]);
}
