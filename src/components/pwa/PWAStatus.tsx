import { useEffect, useState } from 'react';
import { Download, RefreshCw, Wifi, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALL_DISMISS_KEY = 'sbp_install_dismissed_at';
const INSTALL_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function installPromptWasRecentlyDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
    return Date.now() - dismissedAt < INSTALL_RETRY_MS;
  } catch {
    return false;
  }
}

export default function PWAStatus() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_url, nextRegistration) => setRegistration(nextRegistration),
    onRegisterError: (error) => console.warn('[PWA] service worker registration failed', error),
  });

  useEffect(() => {
    if (!registration) return;
    const timer = window.setInterval(() => {
      if (navigator.onLine) void registration.update();
    }, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [registration]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (isStandalone()) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      if (!installPromptWasRecentlyDismissed()) {
        window.setTimeout(() => setShowInstall(true), 12_000);
      }
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowInstall(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
      setShowInstall(false);
    }
  }

  function dismissInstall() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage can be unavailable in strict private-browsing modes.
    }
    setShowInstall(false);
  }

  const visible = needRefresh || offlineReady || (showInstall && !!installEvent);
  if (!visible) return null;

  const mode = needRefresh ? 'update' : offlineReady ? 'offline' : 'install';
  const Icon = mode === 'update' ? RefreshCw : mode === 'offline' ? Wifi : Download;
  const title = mode === 'update' ? 'Buddy Planner update ready' : mode === 'offline' ? 'Ready to use offline' : 'Install Buddy Planner';
  const detail = mode === 'update' ? 'Update now for the newest fixes.' : mode === 'offline' ? 'Saved pages can open without internet.' : 'Open it from your home screen like an app.';

  function dismiss() {
    if (mode === 'update') setNeedRefresh(false);
    else if (mode === 'offline') setOfflineReady(false);
    else dismissInstall();
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[180] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl"
      role="status"
      aria-live="polite"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-soft">{detail}</span>
      </span>
      {mode === 'update' && (
        <button type="button" onClick={() => void updateServiceWorker(true)} className="min-h-11 rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white">
          Update
        </button>
      )}
      {mode === 'install' && (
        <button type="button" onClick={() => void install()} className="min-h-11 rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white">
          Install
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label={`Dismiss ${mode} message`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt">
        <X size={16} />
      </button>
    </aside>
  );
}
