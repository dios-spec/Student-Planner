import { useEffect, useState } from 'react';
import { watchConversation } from '../firebase/conversations';
import type { Conversation } from '../types';

/** Keeps call/group holders synced with the current conversation name and photo. */
export function useLiveConversation(conversationId: string | undefined): Conversation | null {
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    setConversation(null);
    if (!conversationId) return;
    return watchConversation(conversationId, setConversation);
  }, [conversationId]);

  return conversation;
}
