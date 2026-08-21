import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CLASSES, isClassId, type ClassId } from '../data/classes';
import { useAuth } from './AuthContext';

interface ClassContextValue {
  activeClass: ClassId;
  setActiveClass: (c: ClassId) => void;
}

const ClassContext = createContext<ClassContextValue | undefined>(undefined);

export function ClassProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [activeClass, setActiveClassState] = useState<ClassId>(() => {
    const stored = localStorage.getItem('sbp_active_class');
    return isClassId(stored) ? stored : CLASSES[0];
  });

  // On first load, if the user hasn't manually picked a class this session,
  // default the view to their own class from their profile.
  useEffect(() => {
    const stored = localStorage.getItem('sbp_active_class');
    if (!stored && profile?.classId && isClassId(profile.classId)) {
      setActiveClassState(profile.classId);
    }
  }, [profile?.classId]);

  const setActiveClass = (c: ClassId) => {
    localStorage.setItem('sbp_active_class', c);
    setActiveClassState(c);
  };

  return (
    <ClassContext.Provider value={{ activeClass, setActiveClass }}>
      {children}
    </ClassContext.Provider>
  );
}

export function useActiveClass() {
  const ctx = useContext(ClassContext);
  if (!ctx) throw new Error('useActiveClass must be used within ClassProvider');
  return ctx;
}
