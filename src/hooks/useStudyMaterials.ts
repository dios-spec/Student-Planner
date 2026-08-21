import { watchStudyMaterials } from '../firebase/study';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { StudyMaterial } from '../types';

export function useStudyMaterials(classId: string) {
  const { data, loading } = useCachedSnapshot<StudyMaterial[]>(
    `study:${classId}`,
    (cb) => watchStudyMaterials(classId, cb)
  );
  return { materials: data, loading };
}
