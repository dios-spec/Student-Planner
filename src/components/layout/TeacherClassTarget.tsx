import { CLASSES, CLASS_COLORS, type ClassId } from '../../data/classes';

interface TeacherClassTargetProps {
  value: ClassId;
  onChange: (value: ClassId) => void;
  label?: string;
}

export default function TeacherClassTarget({
  value,
  onChange,
  label = 'Send to class',
}: TeacherClassTargetProps) {
  return (
    <div className="rounded-2xl border border-accent/25 bg-accent-soft/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <span className="rounded-full bg-surface px-2 py-0.5 text-2xs font-semibold text-accent">
          Teacher
        </span>
      </div>
      <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {CLASSES.map((classId) => {
          const active = classId === value;
          return (
            <button
              key={classId}
              type="button"
              onClick={() => onChange(classId)}
              aria-pressed={active}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                active ? 'text-white' : 'text-ink-soft hover:text-ink'
              }`}
              style={active ? { backgroundColor: CLASS_COLORS[classId] } : undefined}
            >
              {classId}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Students in {value} will see this content.
      </p>
    </div>
  );
}
