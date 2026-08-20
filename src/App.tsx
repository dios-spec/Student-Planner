import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import BottomNav from './components/layout/BottomNav';
import OfflineBanner from './components/layout/OfflineBanner';
import PlannerPage from './pages/PlannerPage';
import UpcomingPage from './pages/UpcomingPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';

function WelcomeMessage() {
  const { isFirstVisit, dismissWelcome, loading } = useAuth();
  const { show } = useToast();

  useEffect(() => {
    if (!loading && isFirstVisit) {
      show('Welcome! 👋 Tap your profile whenever you want to change your name or photo.');
      dismissWelcome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isFirstVisit]);

  return null;
}

function AppShell() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
          <p className="text-sm text-ink-soft">Setting things up…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <OfflineBanner />
      <WelcomeMessage />
      <Routes>
        <Route path="/" element={<PlannerPage />} />
        <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
