import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, Download, Bookmark } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import ClassSelector from '../components/layout/ClassSelector';
import Avatar from '../components/shared/Avatar';
import EmptyState from '../components/shared/EmptyState';
import { PlannerSkeleton } from '../components/shared/Skeleton';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import UploadStudyMaterial from '../components/study/UploadStudyMaterial';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';
import { useStudyMaterials } from '../hooks/useStudyMaterials';
import { deleteStudyMaterial } from '../firebase/study';
import { subjectById, DEFAULT_SUBJECTS } from '../data/subjects';
import { useActiveClass } from '../context/ClassContext';
import { useAuth } from '../context/AuthContext';
import { useSavedItems } from '../hooks/useSavedItems';
import { saveItem, unsaveItem } from '../firebase/saved';
import { relativeTime } from '../utils/date';
import type { StudyMaterial } from '../types';

export default function StudyHelpPage() {
  const { user } = useAuth();
  const { activeClass } = useActiveClass();
  const { materials, loading } = useStudyMaterials(activeClass);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [q, setQ] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);
  const { isSaved } = useSavedItems(user?.uid);

  const filtered = useMemo(() => {
    let list = materials || [];
    if (subjectFilter) list = list.filter((m) => m.subject === subjectFilter);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(s) ||
          m.chapter.toLowerCase().includes(s) ||
          subjectById(m.subject).name.toLowerCase().includes(s)
      );
    }
    return list;
  }, [materials, subjectFilter, q]);

  // group by subject -> chapter
  const grouped = useMemo(() => {
    const bySubject: Record<string, Record<string, StudyMaterial[]>> = {};
    filtered.forEach((m) => {
      bySubject[m.subject] = bySubject[m.subject] || {};
      bySubject[m.subject][m.chapter] = bySubject[m.subject][m.chapter] || [];
      bySubject[m.subject][m.chapter].push(m);
    });
    return bySubject;
  }, [filtered]);

  return (
    <div className="pb-28">
      <TopBar title="Study Help" />

      <div className="space-y-4 px-4 pt-4">
        <ClassSelector />

        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
          <Search size={16} className="text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes, chapters, subjects…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubjectFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !subjectFilter ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
            }`}
          >
            All
          </button>
          {DEFAULT_SUBJECTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubjectFilter(s.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                subjectFilter === s.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {loading && <PlannerSkeleton />}

        {!loading && filtered.length === 0 && (
          <EmptyState
            emoji="📖"
            title="No study material yet"
            subtitle={`Be the first to share notes for ${activeClass}!`}
          />
        )}

        {Object.entries(grouped).map(([subj, chapters]) => (
          <section key={subj}>
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">{subjectById(subj).name}</h3>
            {Object.entries(chapters).map(([chapter, items]) => (
              <div key={chapter} className="mb-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">{chapter}</p>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((m) => (
                    <div key={m.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                      <button onClick={() => setPreview(m.imageUrl)} className="block w-full">
                        <img src={m.imageUrl} alt={m.title} className="aspect-square w-full object-cover" />
                      </button>
                      <div className="p-2">
                        <p className="truncate text-xs font-semibold text-ink">{m.title}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Avatar name={m.uploaderName} src={m.uploaderAvatar} size="sm" />
                          <span className="truncate text-[10px] text-ink-soft">{m.uploaderName}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px] text-ink-soft">
                            {m.createdAt?.toDate ? relativeTime(m.createdAt.toDate()) : ''}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => user && (isSaved('study', m.id)
                                ? unsaveItem(user.uid, 'study', m.id)
                                : saveItem({ userId: user.uid, type: 'study', refId: m.id, title: m.title, imageUrl: m.imageUrl, authorName: m.uploaderName }))}
                              aria-label={isSaved('study', m.id) ? 'Unsave' : 'Save'}
                              className={isSaved('study', m.id) ? 'text-accent' : 'text-ink-soft hover:text-accent'}
                            >
                              <Bookmark size={13} className={isSaved('study', m.id) ? 'fill-current' : ''} />
                            </button>
                            <a
                              href={m.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-ink-soft hover:text-accent"
                              aria-label="Open / download"
                            >
                              <Download size={13} />
                            </a>
                            {m.uploaderId === user?.uid && (
                              <button
                                onClick={() => setDeleteTarget(m)}
                                aria-label="Delete"
                                className="text-ink-soft hover:text-coral"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      <button
        onClick={() => setUploadOpen(true)}
        className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-lg active:scale-95 sm:bottom-8"
      >
        <Plus size={18} strokeWidth={2.5} /> Upload
      </button>

      <UploadStudyMaterial open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete study material?"
        message={`"${deleteTarget?.title}" will be removed for everyone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteTarget) deleteStudyMaterial(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
