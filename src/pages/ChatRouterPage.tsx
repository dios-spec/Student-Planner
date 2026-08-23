import ChatPage from './ChatPage';
import TeacherChatPage from './TeacherChatPage';
import { useAuth } from '../context/AuthContext';

export default function ChatRouterPage() {
  const { isTeacher, claimsLoading } = useAuth();

  if (claimsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center" role="status" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
        <span className="sr-only">Checking chat accessâ€¦</span>
      </div>
    );
  }

  return isTeacher ? <TeacherChatPage /> : <ChatPage />;
}
