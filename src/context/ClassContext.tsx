import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CLASSES, isClassId, type ClassId } from '../data/classes';
import { useAuth } from './AuthContext';

interface ClassContextValue {
  activeClass: ClassId;
  setActiveClass: (c: ClassId) => void;
}

const ClassContext = createContext<ClassContextValue | undefined>(undefined);

export function ClassProvider({ children }: { children: ReactNode }) {
  const { profile, isTeacher } = useAuth();

  const studentClass: ClassId =
    profile?.classId && isClassId(profile.classId) ? profile.classId : CLASSES[0];

  const [teacherClass, setTeacherClass] = useState<ClassId>(() => {
    const stored = localStorage.getItem('sbp_active_class');
    return isClassId(stored) ? stored : studentClass;
  });

  useEffect(() => {
    // A stale teacher target must never carry into a student session.
    if (!isTeacher) localStorage.removeItem('sbp_active_class');
  }, [isTeacher]);

  const activeClass = isTeacher ? teacherClass : studentClass;

  function setActiveClass(c: ClassId) {
    if (!isTeacher) return;
    localStorage.setItem('sbp_active_class', c);
    setTeacherClass(c);
  }

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
