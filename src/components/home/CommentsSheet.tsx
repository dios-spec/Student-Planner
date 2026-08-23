import { useEffect, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import Modal from '../shared/Modal';
import Avatar from '../shared/Avatar';
import EmptyState from '../shared/EmptyState';
import { watchComments, addComment, deleteComment } from '../../firebase/comments';
import { useAuth } from '../../context/AuthContext';
import { relativeTime } from '../../utils/date';
import { containsBlockedLanguage, isRateLimited } from '../../utils/moderation';
import type { Comment } from '../../types';
import { useLiveProfiles, liveName, liveAvatar } from '../../hooks/useLiveProfiles';
import StudentMeritPill from '../merit/StudentMeritPill';

interface CommentsSheetProps {
  postId: string | null;
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
}

export default function CommentsSheet({ postId, onClose, onOpenProfile }: CommentsSheetProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const profiles = useLiveProfiles((comments || []).map((comment) => comment.authorId));

  useEffect(() => {
    if (!postId) {
      setComments(null);
      return;
    }
    return watchComments(postId, setComments);
  }, [postId]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !postId || !user || !profile) return;
    if (isRateLimited('comment')) {
      setWarning('Slow down a moment before commenting again.');
      return;
    }
    if (containsBlockedLanguage(trimmed)) {
      setWarning("Let's keep it friendly — comment not posted.");
      return;
    }
    await addComment({
      postId,
      authorId: user.uid,
      authorName: profile.displayName,
      authorAvatar: profile.avatarUrl,
      text: trimmed.slice(0, 300),
    });
    setText('');
    setWarning(null);
  }

  return (
    <Modal open={!!postId} onClose={onClose} title="Comments" fullHeight>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pb-3">
          {comments === null && <p className="py-6 text-center text-sm text-ink-soft">Loading…</p>}
          {comments?.length === 0 && <EmptyState emoji="💬" title="No comments yet" subtitle="Be the first!" />}
          {comments?.map((c) => {
            const created = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
            const authorName = liveName(profiles, c.authorId, c.authorName);
            const authorAvatar = liveAvatar(profiles, c.authorId, c.authorAvatar);
            return (
              <div key={c.id} className="flex gap-2.5">
                <button onClick={() => onOpenProfile(c.authorId)}>
                  <Avatar name={authorName} src={authorAvatar} size="sm" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <button onClick={() => onOpenProfile(c.authorId)} className="font-semibold">
                      {authorName}
                    </button>{' '}
                    {c.text}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-ink-soft">{relativeTime(created)}</span>
                    <StudentMeritPill uid={c.authorId} size="micro" />
                  </div>
                </div>
                {c.authorId === user?.uid && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    aria-label="Delete comment"
                    className="shrink-0 text-ink-soft hover:text-coral"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-line pt-3">
          {warning && <p className="mb-1.5 text-xs font-medium text-coral">{warning}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Add a comment…"
              className="max-h-24 flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              aria-label="Post comment"
              className="shrink-0 rounded-full bg-accent p-2.5 text-white disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
