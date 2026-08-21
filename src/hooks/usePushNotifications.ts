import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { initPush } from "../firebase/push";

export function usePushNotifications() {
  const { user, profile } = useAuth();
  useEffect(() => {
    if (user && profile?.onboarded) initPush(user.uid);
  }, [user, profile?.onboarded]);
}
