import Avatar from '../shared/Avatar';
import EmptyState from '../shared/EmptyState';
import { PlannerSkeleton } from '../shared/Skeleton';
import { relativeTime } from '../../utils/date';
import type { Conversation } from '../../types';

export default function ConversationList({
  conversations,
  loading,
  myUid,
  onOpen,
}: {
  conversations: Conversation[] | null;
  loading: boolean;
  myUid: string;
  onOpen: (c: Conversation) => void;
}) {
  if (loading) return <div className="pt-3"><PlannerSkeleton /></div>;
  if (!conversations || conversations.length === 0) {
    return (
      <div className="px-4 pt-6">
        <EmptyState emoji="💌" title="No chats yet" subtitle="Open someone's profile and tap Message to start." />
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {conversations.map((c) => {
        const isGroup = c.type === 'group';
        const otherId = isGroup ? '' : c.memberIds.find((m) => m !== myUid) || '';
        const other = c.members[otherId];
        const title = isGroup ? c.name || 'Group' : other?.name || 'Chat';
        const photo = isGroup ? c.photoUrl : other?.avatar;
        const unread = c.unread?.[myUid] ?? 0;
        const time = c.lastAt?.toDate ? relativeTime(c.lastAt.toDate()) : '';

        return (
          <button
            key={c.id}
            onClick={() => onOpen(c)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-alt"
          >
            <Avatar name={title} src={photo} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate text-sm ${unread > 0 ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>
                  {title}
                </p>
                <span className="shrink-0 text-[11px] text-ink-soft">{time}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate text-xs ${unread > 0 ? 'font-medium text-ink' : 'text-ink-soft'}`}>
                  {c.lastText || 'No messages yet'}
                </p>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
