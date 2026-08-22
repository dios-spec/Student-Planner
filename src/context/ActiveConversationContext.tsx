import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

interface ActiveConversationValue {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

const Ctx = createContext<ActiveConversationValue>({
  activeConversationId: null,
  setActiveConversationId: () => {},
});

export function ActiveConversationProvider({ children }: { children: ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const value = useMemo(() => ({ activeConversationId, setActiveConversationId }), [activeConversationId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveConversation() {
  return useContext(Ctx);
}
