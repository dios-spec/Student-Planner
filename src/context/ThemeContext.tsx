import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemePref = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(
    () => (localStorage.getItem('sbp_theme') as ThemePref) || 'system'
  );
  const [resolved, setResolved] = useState<'light' | 'dark'>(
    pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref
  );

  useEffect(() => {
    const apply = () => setResolved(pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref);
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setPref = (p: ThemePref) => {
    localStorage.setItem('sbp_theme', p);
    setPrefState(p);
  };

  return <ThemeContext.Provider value={{ pref, resolved, setPref }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
