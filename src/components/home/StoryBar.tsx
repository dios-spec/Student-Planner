import { Plus } from 'lucide-react';
import Avatar from '../shared/Avatar';
import type { StoryGroup } from '../../hooks/useStories';
import { useAuth } from '../../context/AuthContext';
import StudentMeritPill from '../merit/StudentMeritPill';

interface StoryBarProps {
  groups: StoryGroup[];
  onOpenGroup: (index: number) => void;
  onCreate: () => void;
}

export default function StoryBar({ groups, onOpenGroup, onCreate }: StoryBarProps) {
  const { user, profile } = useAuth();

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3">
      <button onClick={onCreate} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
        <div className="relative">
          <Avatar name={profile?.displayName || 'You'} src={profile?.avatarUrl} emoji={profile?.emoji} size="story" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-accent text-white">
            <Plus size={13} strokeWidth={3} />
          </span>
        </div>
        <span className="w-full truncate text-center text-xs text-ink-soft">Your story</span>
        <StudentMeritPill uid={user?.uid} size="micro" />
      </button>

      {groups.map((group, i) => {
        const allSeen = group.stories.every((s) => s.seenBy?.includes(user?.uid || ''));
        return (
          <button
            key={group.authorId}
            onClick={() => onOpenGroup(i)}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1"
          >
            <div
              className={`rounded-full p-[2.5px] ${
                allSeen ? 'bg-line' : 'bg-gradient-to-tr from-accent via-coral to-accent'
              }`}
            >
              <div className="rounded-full border-2 border-paper">
                <Avatar name={group.authorName} src={group.authorAvatar} size="story" />
              </div>
            </div>
            <span className="w-full truncate text-center text-xs text-ink-soft">
              {group.authorName}
            </span>
            <StudentMeritPill uid={group.authorId} size="micro" />
          </button>
        );
      })}
    </div>
  );
}
