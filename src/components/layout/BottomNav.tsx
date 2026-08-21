import { NavLink } from 'react-router-dom';
import { Newspaper, Clapperboard, CalendarCheck, BookOpen, Mail, User } from 'lucide-react';
import { useConversations } from '../../hooks/useConversations';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { to: '/', label: 'Home', icon: Newspaper, end: true },
  { to: '/reels', label: 'Reels', icon: Clapperboard, end: false },
  { to: '/planner', label: 'Planner', icon: CalendarCheck, end: false },
  { to: '/study', label: 'Study', icon: BookOpen, end: false },
  { to: '/messages', label: 'Chats', icon: Mail, end: false, dm: true },
  { to: '/profile', label: 'You', icon: User, end: false },
];

export default function BottomNav() {
  const { user } = useAuth();
  const { conversations } = useConversations(user?.uid);
  const totalUnread = (conversations || []).reduce((sum, c) => sum + (c.unread?.[user?.uid || ''] ?? 0), 0);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Main navigation">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ to, label, icon: Icon, end, dm }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-ink-soft'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  {dm && totalUnread > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
