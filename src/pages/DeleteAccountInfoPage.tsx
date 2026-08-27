import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Public, no sign-in required. Google Play requires a URL that explains how to
 * request account deletion and what happens to the data.
 */
export default function DeleteAccountInfoPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/95 px-2 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-surface-alt"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink">Delete your account</h1>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-16">
        <section className="space-y-1.5">
          <h2 className="font-display text-base font-semibold text-ink">How to delete your account</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-ink-soft">
            <li>Open Buddy Planner and go to the <span className="font-semibold text-ink">You</span> tab.</li>
            <li>Scroll to <span className="font-semibold text-ink">Delete account</span>.</li>
            <li>Tap <span className="font-semibold text-ink">Delete my account</span> and type DELETE to confirm.</li>
          </ol>
          <p className="text-sm leading-6 text-ink-soft">
            Deletion happens immediately. It cannot be undone.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-display text-base font-semibold text-ink">What is deleted</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Your sign-in identity; your profile details, picture and bio; your posts, stories, reels
            and comments; your saved items, personal notes, reminders and task completion; your
            notifications; blocks you made or received; and the push notification tokens for every
            device you used.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-display text-base font-semibold text-ink">What is kept, and why</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-soft">
            <li>
              Messages you sent stay in other people's conversations, but the content is emptied and
              the sender shown as "Deleted user" — otherwise other pupils' chat history would develop
              gaps.
            </li>
            <li>
              Homework, exams and timetable entries you added stay for the rest of your class.
            </li>
            <li>
              Merit and demerit records are school records and are kept. How long the school keeps
              them is set by the school.
            </li>
            <li>
              Reports you submitted are kept so they can still be reviewed.
            </li>
            <li>
              Uploaded images, video and voice notes are stored by Cloudinary and are not currently
              removed automatically. Ask your teacher if you need these deleted.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-display text-base font-semibold text-ink">If you cannot open the app</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Ask your teacher or the person who runs Buddy Planner at your school to delete the
            account for you.
          </p>
          <p className="text-xs leading-5 text-ink-soft">
            A contact email address needs to be added here before release.
          </p>
        </section>
      </div>
    </div>
  );
}
