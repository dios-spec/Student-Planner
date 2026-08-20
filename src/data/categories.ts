import type { PlannerCategory } from '../types';

export const CATEGORY_META: Record<
  PlannerCategory,
  { label: string; icon: string; plural: string }
> = {
  bring: { label: 'Get / Bring', icon: 'Backpack', plural: 'Things to Bring' },
  reading: { label: 'Reading', icon: 'BookOpen', plural: 'Reading' },
  writing: { label: 'Writing / Homework', icon: 'PencilLine', plural: 'Homework' },
  test: { label: 'Test', icon: 'ClipboardCheck', plural: 'Tests' },
  project: { label: 'Project', icon: 'FolderKanban', plural: 'Projects' },
  important: { label: 'Important', icon: 'Megaphone', plural: 'Important' },
};

export const CATEGORY_ORDER: PlannerCategory[] = [
  'important',
  'test',
  'writing',
  'reading',
  'project',
  'bring',
];
