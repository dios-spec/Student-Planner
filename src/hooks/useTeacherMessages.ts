import { useEffect, useState } from 'react';
import { watchRecentTeacherMessages } from '../firebase/teacherChat';
import type { ChatMessage } from '../types';

export function useTeacherMessages() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  useEffect(() => watchRecentTeacherMessages(setMessages), []);

  return {
    messages: messages || [],
    loading: messages === null,
  };
}
