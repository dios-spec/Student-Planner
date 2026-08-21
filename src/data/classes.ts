export type ClassId = '7A' | '7B' | '7C';

export const CLASSES: ClassId[] = ['7A', '7B', '7C'];

export const CLASS_COLORS: Record<ClassId, string> = {
  '7A': '#4A55E1',
  '7B': '#12A594',
  '7C': '#D98A2E',
};

export function isClassId(v: unknown): v is ClassId {
  return v === '7A' || v === '7B' || v === '7C';
}
