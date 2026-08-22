import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ClassProvider } from './context/ClassContext';
import { CallProvider } from './context/CallContext';
import { ActiveConversationProvider } from './context/ActiveConversationContext';
import BottomNav from './components/layout/BottomNav';
import OfflineBanner from './components/layout/OfflineBanner';
import SplashScreen from './components/onboarding/SplashScreen';
import Onboarding from './components/onboarding/Onboarding';
import NotificationPrompt from './components/shared/NotificationPrompt';
import LiveNotificationBanner from './components/shared/LiveNotificationBanner';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';
import { usePushNotifications } from './hooks/usePushNotifications';

const HomePage = lazy(() => import('./pages/HomePage'));
const PlannerPage = lazy(() => import('./pages/PlannerPage'));
const UpcomingPage = lazy(() => import('./pages/UpcomingPage'));
const StudyHelpPage = lazy(() => import('./pages/StudyHelpPage'));
const ReelsPage = lazy(() => import('./pages/ReelsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
    </div>
  );
}

/** Fires background browser notifications; rendered inside providers so it has auth. */
function BackgroundNotifier() {
  useBrowserNotifications();
  return null;
}

function AppShell() {
  const { loading, profile } = useAuth();
  usePushNotifications();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
          <p className="text-sm text-ink-soft">Setting things upâ€¦</p>
        </div>
      </div>
    );
  }

  if (profile && !profile.onboarded) {
    return <Onboarding onDone={() => {}} />;
  }

  return (
    <ClassProvider>
      <CallProvider>
      <ActiveConversationProvider>
        <BackgroundNotifier />
        <LiveNotificationBanner />
        <div className="min-h-[100dvh] bg-paper text-ink">
          <OfflineBanner />
          <NotificationPrompt />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/upcoming" element={<UpcomingPage />} />
              <Route path="/study" element={<StudyHelpPage />} />
              <Route path="/reels" element={<ReelsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </Suspense>
          <BottomNav />
        </div>
      </ActiveConversationProvider>
      </CallProvider>
    </ClassProvider>
  );
}

export default function App() {

  const [splashDone, setSplashDone] = useState(false);

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}


