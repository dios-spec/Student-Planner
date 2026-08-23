import { useEffect, useRef, useState } from 'react';
import { watchUserProfile } from '../firebase/users';
import type { StudentProfile } from '../types';

/** Subscribes to the CURRENT profile of every unique uid passed in, so a
 * rename/avatar change shows immediately everywhere -- instead of the
 * name/avatar frozen on messages/posts/reels/stories at creation time.
 * One listener per unique person actually visible, not one per item. */
export function useLiveProfiles(uids: (string | undefined | null)[]): Record<string, StudentProfile> {
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({});
  const unsubsRef = useRef<Record<string, () => void>>({});

  const uniqueIds = Array.from(new Set(uids.filter((id): id is string => !!id)));
  const key = uniqueIds.slice().sort().join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    const current = unsubsRef.current;

    ids.forEach((id) => {
      if (!current[id]) {
        current[id] = watchUserProfile(id, (p) => {
          setProfiles((prev) => {
            if (!p) {
              if (!(id in prev)) return prev;
              const next = { ...prev };
              delete next[id];
              return next;
            }
            return { ...prev, [id]: p };
          });
        });
      }
    });

    Object.keys(current).forEach((id) => {
      if (!ids.includes(id)) {
        current[id]();
        delete current[id];
        setProfiles((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    return () => {
      Object.values(unsubsRef.current).forEach((unsub) => unsub());
      unsubsRef.current = {};
    };
  }, []);

  return profiles;
}

export function liveName(profiles: Record<string, StudentProfile>, uid: string, fallback: string): string {
  return profiles[uid]?.displayName || fallback;
}

export function liveAvatar(profiles: Record<string, StudentProfile>, uid: string, fallback: string | undefined): string | undefined {
  return profiles[uid]?.avatarUrl ?? fallback;
}
