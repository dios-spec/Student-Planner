import { watchRecentMessages } from '../firebase/chat';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { ChatMessage } from '../types';

export function useMessages() {
  const { data, loading } = useCachedSnapshot<ChatMessage[]>('messages', watchRecentMessages);
  return { messages: data, loading };
}
