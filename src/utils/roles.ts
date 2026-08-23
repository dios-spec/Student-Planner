import type { StudentProfile } from '../types';

/** Profile badges are trusted only when both server-managed fields are present. */
export function isVerifiedTeacherProfile(
  profile: Pick<StudentProfile, 'role' | 'teacherVerifiedAt' | 'teacherRoleVersion'> | null | undefined
): boolean {
  return profile?.role === 'teacher' && profile.teacherVerifiedAt != null && profile.teacherRoleVersion === 1;
}
