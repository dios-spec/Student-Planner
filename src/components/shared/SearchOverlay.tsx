import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Compass,
  LibraryBig,
  Megaphone,
  Paperclip,
  Search,
  X,
} from 'lucide-react';
import { getAllActiveItemsOnce } from '../../firebase/planner';
import { getAnnouncementsOnce } from '../../firebase/announcements';
import { getStudyMaterialsOnce } from '../../firebase/study';
import { useActiveClass } from '../../context/ClassContext';
import { subjectById } from '../../data/subjects';
import { CATEGORY_META } from '../../data/categories';
import { studyKindMeta } from '../../data/study';
import { relativeDayLabel, todayKey } from '../../utils/date';
import type { Announcement, PlannerItem, StudyMaterial } from '../../types';
import EmptyState from './EmptyState';

type ResultKind = 'page' | 'planner' | 'announcement' | 'study';
type ResultFilter = 'all' | ResultKind;

interface SearchData {
  planner: PlannerItem[];
  announcements: Announcement[];
  study: StudyMaterial[];
}

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  meta: string;
  route: string;
  searchable: string;
  imageUrl?: string;
  attachmentCount?: number;
}

const CACHE_TTL = 60_000;
const cache = new Map<string, { data: SearchData; at: number }>();

const PAGE_RESULTS: SearchResult[] = [
  { id: 'page-planner', kind: 'page', title: 'Planner', subtitle: 'Homework, tests and projects', meta: 'Open page', route: '/planner', searchable: 'planner homework tests exams projects tasks' },
  { id: 'page-upcoming', kind: 'page', title: 'Upcoming', subtitle: 'Deadlines and future class work', meta: 'Open page', route: '/upcoming', searchable: 'upcoming deadlines future work countdowns' },
  { id: 'page-study', kind: 'page', title: 'Study Help', subtitle: 'Shared notes and chapter resources', meta: 'Open page', route: '/study', searchable: 'study help notes resources chapters formulas' },
  { id: 'page-timetable', kind: 'page', title: 'Timetable', subtitle: 'Your class schedule', meta: 'Open page', route: '/timetable', searchable: 'timetable schedule periods subjects teachers' },
  { id: 'page-chats', kind: 'page', title: 'Chats', subtitle: 'Direct and group conversations', meta: 'Open page', route: '/messages', searchable: 'chats messages direct groups people' },
  { id: 'page-saved', kind: 'page', title: 'Saved', subtitle: 'Your bookmarked content', meta: 'Open page', route: '/saved', searchable: 'saved bookmarks posts reels study' },
];

const FILTERS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'planner', label: 'Planner' },
  { value: 'announcement', label: 'Announcements' },
  { value: 'study', label: 'Study Help' },
  { value: 'page', label: 'Pages' },
];

function normalise(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function resultIcon(kind: ResultKind) {
  if (kind === 'planner') return CalendarDays;
  if (kind === 'announcement') return Megaphone;
  if (kind === 'study') return LibraryBig;
  return Compass;
}

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { activeClass } = useActiveClass();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [data, setData] = useState<SearchData | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFilter('all');
    setError(false);

    const cached = cache.get(activeClass);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setData(cached.data);
      return;
    }

    let cancelled = false;
    setData(null);
    Promise.all([
      getAllActiveItemsOnce(activeClass),
      getAnnouncementsOnce(activeClass),
      getStudyMaterialsOnce(activeClass),
    ])
      .then(([planner, announcements, study]) => {
        if (cancelled) return;
        const next = { planner, announcements, study };
        cache.set(activeClass, { data: next, at: Date.now() });
        setData(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, [open, activeClass, reloadKey]);

  const allResults = useMemo<SearchResult[]>(() => {
    if (!data) return PAGE_RESULTS;
    const planner = data.planner.map((item): SearchResult => {
      const due = (item.category === 'test' || item.category === 'project') && item.dueDate ? item.dueDate : item.date;
      const attachmentNames = (item.attachments || []).map((attachment) => attachment.name || '').join(' ');
      return {
        id: `planner-${item.id}`,
        kind: 'planner',
        title: item.title,
        subtitle: `${subjectById(item.subject).name} · ${CATEGORY_META[item.category].label}`,
        meta: relativeDayLabel(due),
        route: `/planner?date=${encodeURIComponent(item.date)}`,
        searchable: [item.title, item.description, item.portion, item.note, item.subject, subjectById(item.subject).name, CATEGORY_META[item.category].label, attachmentNames].filter(Boolean).join(' '),
        imageUrl: item.attachments?.[0]?.url,
        attachmentCount: item.attachments?.length,
      };
    });

    const announcements = data.announcements.map((item): SearchResult => ({
      id: `announcement-${item.id}`,
      kind: 'announcement',
      title: item.title,
      subtitle: item.body || `Announcement by ${item.createdByName}`,
      meta: item.forDate ? relativeDayLabel(item.forDate) : 'Announcement',
      route: `/planner?date=${encodeURIComponent(item.forDate || todayKey())}`,
      searchable: [item.title, item.body, item.createdByName, 'announcement notice'].filter(Boolean).join(' '),
    }));

    const study = data.study.map((item): SearchResult => ({
      id: `study-${item.id}`,
      kind: 'study',
      title: item.title,
      subtitle: `${subjectById(item.subject).name} · ${item.chapter}`,
      meta: studyKindMeta(item.kind).shortLabel,
      route: `/study?subject=${encodeURIComponent(item.subject)}&chapter=${encodeURIComponent(item.chapter)}&material=${encodeURIComponent(item.id)}`,
      searchable: [item.title, item.description, item.chapter, item.subject, subjectById(item.subject).name, item.uploaderName, studyKindMeta(item.kind).label].filter(Boolean).join(' '),
      imageUrl: item.imageUrl,
    }));

    return [...PAGE_RESULTS, ...planner, ...announcements, ...study];
  }, [data]);

  const results = useMemo(() => {
    const term = normalise(query);
    if (!term) return [];
    return allResults
      .filter((item) => filter === 'all' || item.kind === filter)
      .map((item) => {
        const title = normalise(item.title);
        const haystack = normalise(`${item.title} ${item.searchable}`);
        const score = title.startsWith(term) ? 0 : title.includes(term) ? 1 : haystack.includes(term) ? 2 : 99;
        return { item, score };
      })
      .filter(({ score }) => score < 99)
      .sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 60)
      .map(({ item }) => item);
  }, [allResults, filter, query]);

  if (!open) return null;

  function openResult(result: SearchResult) {
    onClose();
    navigate(result.route);
  }

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[140] flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label="Search Buddy Planner">
      <div className="border-b border-line bg-surface px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded-full p-2 text-ink-soft hover:bg-surface-alt">
            <ArrowLeft size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 focus-within:border-accent">
            <Search size={17} className="shrink-0 text-ink-soft" />
            <input
              aria-label="Search Buddy Planner"
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search everything in ${activeClass}…`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="rounded-full p-1 text-ink-soft hover:bg-surface-alt">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto" aria-label="Search result type">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                filter === item.value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
        {!query.trim() && (
          <div className="rounded-2xl border border-line bg-surface p-5 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Search size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Search the whole app</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">Find homework, tests, projects, announcements, Study Help resources and app pages.</p>
          </div>
        )}

        {query.trim() && data === null && !error && (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-accent-soft border-t-accent" aria-label="Loading search" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-line bg-surface p-5 text-center">
            <p className="text-sm font-semibold text-ink">Search could not load</p>
            <p className="mt-1 text-xs text-ink-soft">Check your connection and try again.</p>
            <button type="button" onClick={() => { setError(false); setReloadKey((value) => value + 1); }} className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">
              Try again
            </button>
          </div>
        )}

        {query.trim() && data !== null && results.length === 0 && !error && (
          <EmptyState emoji="🔍" title="No matches" subtitle={`Nothing found for "${query.trim()}"`} />
        )}

        {query.trim() && results.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">{results.length} {results.length === 1 ? 'result' : 'results'}</p>
            <div className="space-y-2">
              {results.map((result) => {
                const Icon = resultIcon(result.kind);
                return (
                  <button
                    type="button"
                    key={result.id}
                    onClick={() => openResult(result)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left hover:border-accent/40"
                  >
                    {result.imageUrl ? (
                      <img src={result.imageUrl} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                        <Icon size={20} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{result.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-soft">{result.subtitle}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-2xs font-medium text-accent">
                        {result.meta}
                        {!!result.attachmentCount && <><Paperclip size={11} /> {result.attachmentCount}</>}
                      </span>
                    </span>
                    {result.kind === 'page' && <BookOpen size={17} className="shrink-0 text-ink-soft" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
