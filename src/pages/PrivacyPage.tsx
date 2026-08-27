import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Publicly reachable at /privacy, without signing in — Google Play requires a
 * privacy policy URL that anyone can open.
 *
 * Everything stated here is derived from what the code actually does. Nothing
 * about retention periods, legal basis, or the school's own obligations is
 * asserted, because none of that is knowable from the source. Those gaps are
 * marked in the "Still to be confirmed" section rather than invented.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-1.5 text-sm leading-6 text-ink-soft">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
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
        <h1 className="font-display text-lg font-semibold text-ink">Privacy</h1>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-16">
        <p className="text-sm leading-6 text-ink-soft">
          Buddy Planner is a school planner and class chat app. This page describes what the app
          stores and who can see it, based on how the app actually works.
        </p>

        <Section title="Signing in">
          <p>
            Buddy Planner creates an anonymous account for you automatically the first time you open
            it. You can optionally link a Google account or an email address and password so you can
            get back in on another device. Sign-in is handled by Firebase Authentication.
          </p>
          <p>
            If you link Google or email, that address is stored by Firebase Authentication and is
            used only to sign you in. It is never shown on your public profile and other students
            cannot see it.
          </p>
        </Section>

        <Section title="What other people in your school can see">
          <p>
            Your display name, profile picture, emoji, short bio, mood, class, and merit and demerit
            totals are visible to other signed-in Buddy Planner users. So is anything you post:
            posts, stories, reels, comments, polls, class chat messages and study material you upload.
          </p>
          <p>
            Direct messages and group messages are visible to the people in that conversation. Your
            personal notes, saved items, reminders and your own notification list are visible only
            to you.
          </p>
        </Section>

        <Section title="What the app stores">
          <p>
            Profile information; planner items, homework, exams and timetable entries; messages,
            voice notes and images you send; posts, stories and reels; comments, likes, polls and
            saved items; merit and demerit records created by teachers; blocks and reports you make;
            your class; when you were last active; your device timezone; and, if you turn
            notifications on, a push token for each device.
          </p>
          <p>
            Push tokens are stored in a private record that only you and the server can read. They
            are never part of your public profile.
          </p>
        </Section>

        <Section title="Where it is stored">
          <p>
            Data is stored in Google Firebase (Authentication and Cloud Firestore). Images, video
            and voice notes are uploaded to Cloudinary. Push notifications are delivered through
            Firebase Cloud Messaging. Traffic is encrypted in transit.
          </p>
        </Section>

        <Section title="Notifications">
          <p>
            Notifications are optional and your browser or phone controls the permission. You choose
            which kinds you receive, and Quiet Hours can silence them at set times. Turning a
            category off stops the server sending it, not just hiding it.
          </p>
        </Section>

        <Section title="Safety">
          <p>
            You can block another user, which stops direct messages in both directions and is
            enforced on the server, not just in the app. You can report a message; reports are kept
            so they can be reviewed.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            Open <span className="font-semibold text-ink">You → Delete my account</span>, or visit{' '}
            <button onClick={() => navigate('/delete-account')} className="font-semibold text-accent underline">
              the account deletion page
            </button>{' '}
            for full instructions and exactly what is removed.
          </p>
        </Section>

        <Section title="Still to be confirmed">
          <p>
            The following need confirmation by the school and, where relevant, a legal adviser, and
            are deliberately not asserted here: the data controller and contact address; how long
            merit, demerit and moderation records are kept; the lawful basis for processing and any
            parental consent required for pupils under the applicable age; and whether uploaded
            media is deleted from Cloudinary on request.
          </p>
        </Section>
      </div>
    </div>
  );
}
