import { useNavigate } from 'react-router-dom';
import { ChevronRight, TimerReset } from 'lucide-react';
import { useActiveClass } from '../../context/ClassContext';
import { useExamCountdowns } from '../../hooks/useExamCountdowns';
import { daysLeftLabel, daysUntil } from '../../utils/date';
import SubjectPill from '../shared/SubjectPill';

export default function ExamCountdowns() {
  const navigate = useNavigate();
  const { activeClass } = useActiveClass();
  const { exams, loading } = useExamCountdowns(activeClass);

  if (loading || exams.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-coral-soft text-coral">
            <TimerReset size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">Exam countdowns</h3>
            <p className="text-2xs text-ink-soft">Next tests for {activeClass}</p>
          </div>
        </div>
        <button type="button" onClick={() => navigate('/upcoming')} className="flex items-center gap-0.5 text-xs font-semibold text-accent">
          View all <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {exams.slice(0, 5).map((exam) => {
          const examDate = exam.dueDate || exam.date;
          const urgent = daysUntil(examDate) <= 1;
          return (
            <button
              type="button"
              key={exam.id}
              onClick={() => navigate(`/planner?date=${encodeURIComponent(exam.date)}`)}
              className="min-w-[12rem] shrink-0 rounded-xl border border-line bg-paper p-3 text-left"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <SubjectPill subjectId={exam.subject} size="sm" />
                <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${urgent ? 'bg-coral-soft text-coral' : 'bg-accent-soft text-accent'}`}>
                  {daysLeftLabel(examDate)}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-ink">{exam.title}</p>
              <p className="mt-1 truncate text-2xs text-ink-soft">{exam.portion ? `Portion: ${exam.portion}` : 'Open test details'}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
