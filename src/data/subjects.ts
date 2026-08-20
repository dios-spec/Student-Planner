import type { Subject } from '../types';

// Default subjects. More can be appended without changing any component code.
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'maths', name: 'Maths', icon: 'Calculator', color: '#3B6FE0' },
  { id: 'english', name: 'English', icon: 'BookOpenText', color: '#8B5CF6' },
  { id: 'science', name: 'Science', icon: 'FlaskConical', color: '#12A594' },
  { id: 'sst', name: 'Social Science', icon: 'Globe2', color: '#D98A2E' },
  { id: 'hindi', name: 'Hindi', icon: 'Languages', color: '#E0568C' },
  { id: 'gujarati', name: 'Gujarati', icon: 'ScrollText', color: '#4F9D5C' },
];

export function subjectById(id: string, extra: Subject[] = []): Subject {
  return (
    DEFAULT_SUBJECTS.find((s) => s.id === id) ||
    extra.find((s) => s.id === id) || {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      icon: 'BookMarked',
      color: '#6B7280',
    }
  );
}
