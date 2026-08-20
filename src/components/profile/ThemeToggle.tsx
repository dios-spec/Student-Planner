import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const OPTIONS = [
  { key: 'light', icon: Sun, label: 'Light' },
  { key: 'dark', icon: Moon, label: 'Dark' },
  { key: 'system', icon: MonitorSmartphone, label: 'System' },
] as const;

export default function ThemeToggle() {
  const { pref, setPref } = useTheme();
  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setPref(key)}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium ${
            pref === key ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
          }`}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
    </div>
  );
}
