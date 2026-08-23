import { useMemo } from 'react';
import { useMeritContext } from '../context/MeritContext';
import type { StudentProfile } from '../types';

/**
 * Live profile lookup backed by the single app-wide profile listener in
 * MeritProvider. Old posts/messages/reels/stories immediately reflect current
 * names and avatars without opening one Firestore listener per visible person.
 */
export function useLiveProfiles(uids: (string | undefined | null)[]): Record<string, StudentProfile> {
  const { profiles } = useMeritContext();
  const key = Array.from(new Set(uids.filter((id): id is string => !!id))).sort().join(',');

  return useMemo(() => {
    const result: Record<string, StudentProfile> = {};
    if (!key) return result;

    for (const id of key.split(',')) {
      const profile = profiles[id];
      if (profile) result[id] = profile;
    }
    return result;
  }, [key, profiles]);
}

export function liveName(profiles: Record<string, StudentProfile>, uid: string, fallback: string): string {
  return profiles[uid]?.displayName || fallback;
}

export function liveAvatar(profiles: Record<string, StudentProfile>, uid: string, fallback: string | undefined): string | undefined {
  return profiles[uid]?.avatarUrl ?? fallback;
}
