import type { StudyMaterialKind } from '../types';

export const STUDY_KIND_META: Record<
  StudyMaterialKind,
  { label: string; shortLabel: string; emoji: string }
> = {
  notes: { label: 'Class notes', shortLabel: 'Notes', emoji: '📝' },
  summary: { label: 'Chapter summary', shortLabel: 'Summary', emoji: '📚' },
  'formula-sheet': { label: 'Formula sheet', shortLabel: 'Formula', emoji: '🧮' },
  'mind-map': { label: 'Mind map', shortLabel: 'Mind map', emoji: '🧠' },
  'question-paper': { label: 'Question paper', shortLabel: 'Questions', emoji: '📄' },
  diagram: { label: 'Diagram', shortLabel: 'Diagram', emoji: '🔬' },
  other: { label: 'Other resource', shortLabel: 'Other', emoji: '📎' },
};

export const STUDY_KIND_ORDER = Object.keys(STUDY_KIND_META) as StudyMaterialKind[];

export function studyKindMeta(kind?: StudyMaterialKind) {
  return STUDY_KIND_META[kind || 'notes'];
}
