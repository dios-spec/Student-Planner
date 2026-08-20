import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, MessageCircle, User } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Planner', icon: Home, end: true },
  { to: '/upcoming', label: 'Upcoming', icon: CalendarDays, end: false },
  { to: '/chat', label: 'Chat', icon: MessageCircle, end: false },
  { to: '/profile', label: 'Profile', icon: User, end: false },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-w-16 flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-ink-soft'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
