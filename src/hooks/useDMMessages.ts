import { watchDMMessages } from '../firebase/dm';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { DMMessage } from '../types';

export function useDMMessages(conversationId: string | null) {
  const { data, loading } = useCachedSnapshot<DMMessage[]>(
    conversationId ? `dmMsgs:${conversationId}` : 'dmMsgs:none',
    (cb) => (conversationId ? watchDMMessages(conversationId, cb) : () => {})
  );
  return { messages: data, loading };
}
