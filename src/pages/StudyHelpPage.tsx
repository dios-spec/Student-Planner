import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, ChevronDown, Download, LibraryBig, Plus, Search, Trash2, X } from 'lucide-react';
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
import { STUDY_KIND_META, STUDY_KIND_ORDER, studyKindMeta } from '../data/study';
import { useActiveClass } from '../context/ClassContext';
import { useAuth } from '../context/AuthContext';
import { useSavedItems } from '../hooks/useSavedItems';
import { saveItem, unsaveItem } from '../firebase/saved';
import { relativeTime } from '../utils/date';
import type { StudyMaterial, StudyMaterialKind } from '../types';

export default function StudyHelpPage() {
  const { user } = useAuth();
  const { activeClass } = useActiveClass();
  const { materials, loading } = useStudyMaterials(activeClass);
  const [searchParams] = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [q, setQ] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [chapterFilter, setChapterFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<StudyMaterialKind | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const openedDeepLink = useRef<string | null>(null);
  const { isSaved } = useSavedItems(user?.uid);

  const deepLinkKey = searchParams.toString();
  useEffect(() => {
    const subject = searchParams.get('subject');
    const chapter = searchParams.get('chapter');
    if (subject) setSubjectFilter(subject);
    if (chapter) setChapterFilter(chapter);
  }, [deepLinkKey, searchParams]);

  useEffect(() => {
    const materialId = searchParams.get('material');
    if (!materialId || openedDeepLink.current === materialId) return;
    const material = (materials || []).find((item) => item.id === materialId);
    if (material) {
      openedDeepLink.current = materialId;
      setPreview(material.imageUrl);
    }
  }, [deepLinkKey, materials, searchParams]);

  const subjectOptions = useMemo(() => {
    const present = new Set((materials || []).map((item) => item.subject));
    const defaults = DEFAULT_SUBJECTS.map((item) => item.id);
    return [...defaults, ...[...present].filter((id) => !defaults.includes(id))];
  }, [materials]);

  const chapterOptions = useMemo(() => {
    const list = (materials || []).filter((item) => !subjectFilter || item.subject === subjectFilter);
    return [...new Set(list.map((item) => item.chapter))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [materials, subjectFilter]);

  const filtered = useMemo(() => {
    let list = materials || [];
    if (subjectFilter) list = list.filter((item) => item.subject === subjectFilter);
    if (chapterFilter) list = list.filter((item) => item.chapter === chapterFilter);
    if (kindFilter) list = list.filter((item) => (item.kind || 'notes') === kindFilter);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((item) => {
        const kind = studyKindMeta(item.kind).label;
        return [
          item.title,
          item.description,
          item.chapter,
          subjectById(item.subject).name,
          item.uploaderName,
          kind,
        ].some((value) => value?.toLowerCase().includes(term));
      });
    }
    return list;
  }, [materials, subjectFilter, chapterFilter, kindFilter, q]);

  const grouped = useMemo(() => {
    const bySubject: Record<string, Record<string, StudyMaterial[]>> = {};
    filtered.forEach((item) => {
      bySubject[item.subject] = bySubject[item.subject] || {};
      bySubject[item.subject]![item.chapter] = bySubject[item.subject]![item.chapter] || [];
      bySubject[item.subject]![item.chapter]!.push(item);
    });
    return bySubject;
  }, [filtered]);

  const totalChapters = new Set((materials || []).map((item) => `${item.subject}:${item.chapter}`)).size;
  const hasFilters = !!(q.trim() || subjectFilter || chapterFilter || kindFilter);

  function clearFilters() {
    setQ('');
    setSubjectFilter(null);
    setChapterFilter(null);
    setKindFilter(null);
  }

  function toggleChapter(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="pb-28">
      <TopBar title="Study Help" />

      <div className="space-y-4 px-4 pt-4">
        <ClassSelector />

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <LibraryBig size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{activeClass} resource library</p>
            <p className="text-xs text-ink-soft">
              {(materials || []).length} {(materials || []).length === 1 ? 'resource' : 'resources'} · {totalChapters} {totalChapters === 1 ? 'chapter' : 'chapters'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 focus-within:border-accent">
          <Search size={16} className="shrink-0 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search resources, chapters or subjects…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="rounded-full p-1 text-ink-soft hover:bg-surface-alt">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by subject">
          <button
            type="button"
            onClick={() => { setSubjectFilter(null); setChapterFilter(null); }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              !subjectFilter ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
            }`}
          >
            All subjects
          </button>
          {subjectOptions.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => { setSubjectFilter(id); setChapterFilter(null); }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                subjectFilter === id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
              }`}
            >
              {subjectById(id).name}
            </button>
          ))}
        </div>

        {chapterOptions.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by chapter">
            <button
              type="button"
              onClick={() => setChapterFilter(null)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                !chapterFilter ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
              }`}
            >
              All chapters
            </button>
            {chapterOptions.map((chapter) => (
              <button
                type="button"
                key={chapter}
                onClick={() => setChapterFilter(chapter)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  chapterFilter === chapter ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
                }`}
              >
                {chapter}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by resource type">
          <button
            type="button"
            onClick={() => setKindFilter(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              !kindFilter ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
            }`}
          >
            Any type
          </button>
          {STUDY_KIND_ORDER.map((kind) => (
            <button
              type="button"
              key={kind}
              onClick={() => setKindFilter(kind)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                kindFilter === kind ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
              }`}
            >
              {STUDY_KIND_META[kind].emoji} {STUDY_KIND_META[kind].shortLabel}
            </button>
          ))}
        </div>

        {loading && <PlannerSkeleton />}

        {!loading && filtered.length === 0 && (
          <div>
            <EmptyState
              emoji="📖"
              title={hasFilters ? 'No matching resources' : 'No study material yet'}
              subtitle={hasFilters ? 'Try removing a filter or using another word.' : `Be the first to share notes for ${activeClass}!`}
            />
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="mx-auto mt-3 block rounded-full border border-line px-4 py-2 text-sm font-medium text-accent">
                Clear all filters
              </button>
            )}
          </div>
        )}

        {Object.entries(grouped).map(([subject, chapters]) => (
          <section key={subject}>
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">{subjectById(subject).name}</h3>
            {Object.entries(chapters).map(([chapter, items]) => {
              const chapterKey = `${subject}:${chapter}`;
              const isCollapsed = collapsed.has(chapterKey);
              return (
                <div key={chapter} className="mb-3 overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    type="button"
                    onClick={() => toggleChapter(chapterKey)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center justify-between px-3.5 py-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-ink">{chapter}</span>
                      <span className="block text-[11px] text-ink-soft">{items.length} {items.length === 1 ? 'resource' : 'resources'}</span>
                    </span>
                    <ChevronDown size={17} className={`text-ink-soft transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>

                  {!isCollapsed && (
                    <div className="grid grid-cols-2 gap-2 border-t border-line p-2 sm:grid-cols-3">
                      {items.map((material) => {
                        const kind = studyKindMeta(material.kind);
                        return (
                          <article key={material.id} className="min-w-0 overflow-hidden rounded-xl border border-line bg-paper">
                            <button type="button" onClick={() => setPreview(material.imageUrl)} className="relative block w-full">
                              <img src={material.imageUrl} alt={material.title} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">
                                {kind.emoji} {kind.shortLabel}
                              </span>
                            </button>
                            <div className="p-2">
                              <p className="truncate text-xs font-semibold text-ink">{material.title}</p>
                              {material.description && <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-ink-soft">{material.description}</p>}
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <Avatar name={material.uploaderName} src={material.uploaderAvatar} size="sm" />
                                <span className="truncate text-[10px] text-ink-soft">{material.uploaderName}</span>
                              </div>
                              <div className="mt-1.5 flex items-center justify-between">
                                <span className="truncate text-[10px] text-ink-soft">
                                  {material.createdAt?.toDate ? relativeTime(material.createdAt.toDate()) : ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => user && (isSaved('study', material.id)
                                      ? unsaveItem(user.uid, 'study', material.id)
                                      : saveItem({ userId: user.uid, type: 'study', refId: material.id, title: material.title, imageUrl: material.imageUrl, authorName: material.uploaderName }))}
                                    aria-label={isSaved('study', material.id) ? 'Remove bookmark' : 'Bookmark'}
                                    className={isSaved('study', material.id) ? 'text-accent' : 'text-ink-soft hover:text-accent'}
                                  >
                                    <Bookmark size={14} className={isSaved('study', material.id) ? 'fill-current' : ''} />
                                  </button>
                                  <a href={material.imageUrl} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-accent" aria-label="Open image">
                                    <Download size={14} />
                                  </a>
                                  {material.uploaderId === user?.uid && (
                                    <button type="button" onClick={() => setDeleteTarget(material)} aria-label="Delete" className="text-ink-soft hover:text-coral">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setUploadOpen(true)}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-lg active:scale-95 sm:bottom-8"
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
          if (deleteTarget) void deleteStudyMaterial(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
