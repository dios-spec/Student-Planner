import { useMemo, useState } from 'react';
import { Award, History, Minus, Plus, Search } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import ClassSelector from '../components/layout/ClassSelector';
import Avatar from '../components/shared/Avatar';
import EmptyState from '../components/shared/EmptyState';
import Modal from '../components/shared/Modal';
import MeritSummaryCard from '../components/merit/MeritSummaryCard';
import MeritHistory from '../components/merit/MeritHistory';
import AwardMeritModal from '../components/merit/AwardMeritModal';
import { useAuth } from '../context/AuthContext';
import { useActiveClass } from '../context/ClassContext';
import { calculateMeritStats } from '../firebase/merits';
import { useClassMeritRecords, useMeritRecords, useMeritRoster } from '../hooks/useMeritRecords';
import { isClassId } from '../data/classes';
import type { MeritKind, MeritRecord, StudentProfile } from '../types';

export default function MeritPage() {
  const { user, profile, isTeacher } = useAuth();

  if (!user || !profile) return null;

  return isTeacher ? (
    <TeacherMeritManager />
  ) : (
    <StudentMeritPage uid={user.uid} />
  );
}

function StudentMeritPage({ uid }: { uid: string }) {
  const { records, loading } = useMeritRecords(uid);

  return (
    <div className="pb-24">
      <TopBar title="Merit & Badges" />
      <div className="space-y-5 px-4 pt-4">
        <MeritSummaryCard uid={uid} />

        <div>
          <div className="mb-2 flex items-center gap-2 px-1">
            <History size={16} className="text-ink-soft" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">History</h2>
          </div>
          {loading ? (
            <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">Loading history...</p>
          ) : (
            <MeritHistory records={records} />
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherMeritManager() {
  const { activeClass } = useActiveClass();
  const { profiles } = useMeritRoster();
  // Exact, class-scoped merit history. Previously these totals came from a
  // school-wide newest-400 window, so every roster figure quietly went wrong
  // once the school passed 400 records.
  const { records } = useClassMeritRecords(activeClass);
  const [query, setQuery] = useState('');
  const [awardStudent, setAwardStudent] = useState<StudentProfile | null>(null);
  const [awardKind, setAwardKind] = useState<MeritKind>('merit');
  const [historyStudent, setHistoryStudent] = useState<StudentProfile | null>(null);

  const students = useMemo(() => {
    const term = query.trim().toLowerCase();
    return profiles
      .filter((student) =>
        isClassId(student.classId) &&
        student.classId === activeClass &&
        student.role !== 'teacher' &&
        student.onboarded !== false
      )
      .filter((student) => !term || student.displayName.toLowerCase().includes(term))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [profiles, activeClass, query]);

  function recordsFor(uid: string) {
    return records.filter((record) => record.studentId === uid);
  }

  function startAward(student: StudentProfile, kind: MeritKind) {
    setAwardStudent(student);
    setAwardKind(kind);
  }

  return (
    <div className="pb-24">
      <TopBar title="Merit & Demerit" />

      <div className="space-y-4 px-4 pt-4">
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-4">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-accent" />
            <p className="text-sm font-semibold text-ink">Teacher Merit Manager</p>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Select a class, then award Merit or Demerit. Totals, badges, history, and profile names update live.
          </p>
        </div>

        <ClassSelector />

        <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
          <Search size={16} className="text-ink-soft" />
          <input
            aria-label={`Search ${activeClass} students`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${activeClass} students...`}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        {students.length === 0 ? (
          <EmptyState emoji={'\u{1F393}'} title={`No ${activeClass} students found`} subtitle="Students appear here from their live profiles." solid />
        ) : (
          <div className="space-y-2">
            {students.map((student) => {
              const studentRecords = recordsFor(student.id);
              const stats = calculateMeritStats(studentRecords);

              return (
                <div key={student.id} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={student.displayName} src={student.avatarUrl} emoji={student.emoji} size="sm" />
                    <button
                      type="button"
                      onClick={() => setHistoryStudent(student)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-ink">{student.displayName}</p>
                      <p className="text-xs text-ink-soft">
                        Merit {stats.merit} / Demerit {stats.demerit} / Balance {stats.net >= 0 ? '+' : ''}{stats.net}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryStudent(student)}
                      aria-label={`View ${student.displayName} Merit history`}
                      className="rounded-full p-2 text-ink-soft hover:bg-surface-alt"
                    >
                      <History size={16} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => startAward(student, 'merit')}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success"
                    >
                      <Plus size={15} /> Merit
                    </button>
                    <button
                      type="button"
                      onClick={() => startAward(student, 'demerit')}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-coral-soft px-3 py-2 text-sm font-semibold text-coral"
                    >
                      <Minus size={15} /> Demerit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AwardMeritModal
        student={awardStudent}
        initialKind={awardKind}
        onClose={() => setAwardStudent(null)}
      />

      <TeacherHistoryModal
        student={historyStudent}
        records={historyStudent ? recordsFor(historyStudent.id) : []}
        onClose={() => setHistoryStudent(null)}
      />
    </div>
  );
}

function TeacherHistoryModal({
  student,
  records,
  onClose,
}: {
  student: StudentProfile | null;
  records: MeritRecord[];
  onClose: () => void;
}) {
  return (
    <Modal open={!!student} onClose={onClose} title={student ? `${student.displayName} - Merit History` : 'Merit History'} fullHeight>
      {student && (
        <div className="space-y-4">
          <MeritSummaryCard uid={student.id} />
          <MeritHistory records={records} />
        </div>
      )}
    </Modal>
  );
}
