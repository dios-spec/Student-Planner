import { CLASSES, CLASS_COLORS } from '../../data/classes';
import { useActiveClass } from '../../context/ClassContext';
import { useAuth } from '../../context/AuthContext';

export default function ClassSelector() {
  const { activeClass, setActiveClass } = useActiveClass();
  const { isTeacher } = useAuth();

  if (!isTeacher) {
    return (
      <div className="space-y-1.5">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          Your class
        </p>
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-alt p-2">
          <span
            className="rounded-full px-4 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: CLASS_COLORS[activeClass] }}
          >
            {activeClass}
          </span>
          <span className="text-xs text-ink-soft">Shared class content</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        Teacher target class
      </p>
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface-alt p-1">
        {CLASSES.map((c) => {
          const active = c === activeClass;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveClass(c)}
              className={`relative flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
                active ? 'text-white' : 'text-ink-soft hover:text-ink'
              }`}
              style={active ? { backgroundColor: CLASS_COLORS[c] } : undefined}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
