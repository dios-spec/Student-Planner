import { CLASSES, CLASS_COLORS } from '../../data/classes';
import { useActiveClass } from '../../context/ClassContext';

/** The 7A | 7B | 7C segmented selector. Made deliberately prominent so students
 *  always know which class's work they're viewing/editing. */
export default function ClassSelector() {
  const { activeClass, setActiveClass } = useActiveClass();

  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface-alt p-1">
      {CLASSES.map((c) => {
        const active = c === activeClass;
        return (
          <button
            key={c}
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
  );
}
