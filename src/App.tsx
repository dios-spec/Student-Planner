import { useState, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ClassProvider } from './context/ClassContext';
import { MeritProvider } from './context/MeritContext';
import { CallProvider } from './context/CallContext';
import { ActiveConversationProvider } from './context/ActiveConversationContext';
import BottomNav from './components/layout/BottomNav';
import OfflineBanner from './components/layout/OfflineBanner';
import SplashScreen from './components/onboarding/SplashScreen';
import NotificationPrompt from './components/shared/NotificationPrompt';
import AccountUpgradePrompt from './components/auth/AccountUpgradePrompt';
import LiveNotificationBanner from './components/shared/LiveNotificationBanner';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';
import { usePushNotifications } from './hooks/usePushNotifications';

const HomePage = lazy(() => import('./pages/HomePage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const DeleteAccountInfoPage = lazy(() => import('./pages/DeleteAccountInfoPage'));
const PlannerPage = lazy(() => import('./pages/PlannerPage'));
const UpcomingPage = lazy(() => import('./pages/UpcomingPage'));
const StudyHelpPage = lazy(() => import('./pages/StudyHelpPage'));
const ReelsPage = lazy(() => import('./pages/ReelsPage'));
const ChatPage = lazy(() => import('./pages/ChatRouterPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'));
const MeritPage = lazy(() => import('./pages/MeritPage'));
const Onboarding = lazy(() => import('./components/onboarding/Onboarding'));
const PWAStatus = lazy(() => import('./components/pwa/PWAStatus'));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

/** Fires background browser notifications; rendered inside providers so it has auth. */
function BackgroundNotifier() {
  useBrowserNotifications();
  return null;
}

function AppNavigation() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/settings/')) return null;
  return <BottomNav />;
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/planner': 'Planner',
  '/upcoming': 'Upcoming',
  '/study': 'Study Help',
  '/reels': 'Reels',
  '/chat': 'Chat',
  '/messages': 'Chats',
  '/notifications': 'Notifications',
  '/timetable': 'Timetable',
  '/saved': 'Saved',
  '/settings/notifications': 'Notification Settings',
  '/merits': 'Merit & Demerit',
  '/profile': 'Profile',
};

function RouteAccessibility() {
  const { pathname } = useLocation();
  const title = ROUTE_TITLES[pathname] || 'Buddy Planner';

  useEffect(() => {
    document.title = title === 'Buddy Planner' ? title : `${title} · Buddy Planner`;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
  }, [pathname, title]);

  return <span className="sr-only" aria-live="polite">{title} page</span>;
}

function AppShell() {
  const { loading, profile } = useAuth();
  usePushNotifications();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-paper" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
          <p className="text-sm text-ink-soft">Setting things up…</p>
        </div>
      </div>
    );
  }

  if (profile && !profile.onboarded) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Onboarding onDone={() => {}} />
      </Suspense>
    );
  }

  return (
    <ClassProvider>
      <MeritProvider>
      <CallProvider>
      <ActiveConversationProvider>
        <BackgroundNotifier />
        <LiveNotificationBanner />
        <div className="min-h-[100dvh] bg-paper text-ink">
          <a href="#main-content" className="sr-only fixed left-3 top-3 z-[250] rounded-lg bg-accent px-4 py-2 font-semibold text-white focus:not-sr-only">
            Skip to main content
          </a>
          <OfflineBanner />
          <NotificationPrompt />
          <AccountUpgradePrompt />
          <RouteAccessibility />
          <main id="main-content" tabIndex={-1} className="outline-none">
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
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
                <Route path="/merits" element={<MeritPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/delete-account" element={<DeleteAccountInfoPage />} />
              </Routes>
            </Suspense>
          </main>
          <AppNavigation />
        </div>
      </ActiveConversationProvider>
      </CallProvider>
      </MeritProvider>
    </ClassProvider>
  );
}

/**
 * Routes that must render WITHOUT signing in.
 *
 * Google Play requires a publicly reachable privacy policy and account
 * deletion page. Everything else in the app sits behind AppShell's loading
 * gate, which waits on Firebase auth -- so if auth were slow or failing, a
 * reviewer opening the privacy URL would see a spinner. These two render
 * straight away instead.
 */
const PUBLIC_PATHS = ['/privacy', '/delete-account'];

function PublicGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  if (!PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/delete-account" element={<DeleteAccountInfoPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(() => {
    try {
      return window.sessionStorage.getItem('buddy-planner-splash-seen') === '1';
    } catch {
      return false;
    }
  });

  function finishSplash() {
    try {
      window.sessionStorage.setItem('buddy-planner-splash-seen', '1');
    } catch {
      // The app still works when storage is unavailable.
    }
    setSplashDone(true);
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <PublicGate>
              {!splashDone && <SplashScreen onDone={finishSplash} />}
              <AppShell />
            </PublicGate>
            <Suspense fallback={null}>
              <PWAStatus />
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
