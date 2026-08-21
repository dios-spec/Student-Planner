import { watchMyConversations } from '../firebase/conversations';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Conversation } from '../types';

export function useConversations(uid: string | undefined) {
  const { data, loading } = useCachedSnapshot<Conversation[]>(
    uid ? `convs:${uid}` : 'convs:none',
    (cb) => (uid ? watchMyConversations(uid, cb) : () => {})
  );
  return { conversations: data, loading };
}
