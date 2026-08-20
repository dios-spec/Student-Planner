import { useEffect, useState } from 'react';
import { watchRecentMessages } from '../firebase/chat';
import type { ChatMessage } from '../types';

export function useMessages() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    const unsub = watchRecentMessages(setMessages);
    return unsub;
  }, []);

  return { messages, loading: messages === null };
}
