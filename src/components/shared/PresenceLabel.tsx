import { presenceFromProfile } from '../../hooks/useUserPresence';
import type { StudentProfile } from '../../types';

/** Small "Online" (green dot) / "Last seen X ago" text. Renders nothing if
 * there's no lastSeen data yet (e.g. a brand-new profile). */
export default function PresenceLabel({ profile, className }: { profile: StudentProfile | null | undefined; className?: string }) {
  const presence = presenceFromProfile(profile);
  if (!presence) return null;

  return (
    <span className={`flex items-center gap-1 text-xs ${presence.online ? 'text-success' : 'text-ink-soft'} ${className || ''}`}>
      {presence.online && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
      {presence.label}
    </span>
  );
}
