# Buddy Planner 📚

A student planner + class chat, built so a group of classmates can open one link and
instantly see homework, reading, tests, projects, things to bring, and announcements —
plus a live chat, with no sign-up.

No login screens, no passwords. Everyone gets an anonymous profile automatically and
data syncs live across every device through Firebase.

## Tech stack

React + TypeScript + Vite + Tailwind CSS v4 + Firebase (Auth, Firestore) + Cloudinary (image uploads) + lucide-react.
No custom backend, and no paid plan required — Firebase's free Spark plan covers Auth + Firestore,
and Cloudinary's free tier (no credit card) covers image uploads.

## 1. Create your Firebase project (~5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Once created, click the **Web** icon (`</>`) to register a web app. Skip Firebase Hosting for now if you don't need it.
3. Copy the `firebaseConfig` values shown — you'll paste them into `.env` in step 3.
4. In the left sidebar:
   - **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
   - **Build → Firestore Database → Create database** (start in production mode — the included rules handle security).
   - Skip **Storage** entirely — this project doesn't use Firebase Storage, so you don't need the paid Blaze plan.

## 2. Create your Cloudinary account (~3 minutes, free, no card)

1. Sign up at [cloudinary.com](https://cloudinary.com) (free plan).
2. On the Dashboard, copy your **Cloud name**.
3. Go to **Settings → Upload → Upload presets → Add upload preset**:
   - Set **Signing Mode** to **Unsigned**
   - Optionally cap **Max file size** (e.g. 8MB) and restrict **Allowed formats** to jpg, png, webp, gif
   - Save, and note the preset's name

## 3. Install dependencies

```bash
npm install
```

## 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in the Firebase values from step 1 and the Cloudinary values from step 2. All of
these are safe to expose in a frontend bundle — none of them are secrets. Real protection
for your data comes from `firestore.rules` (step 5) and, on the Cloudinary side, the
preset's file-size/format restrictions.

## 5. Deploy the Firestore security rules

Install the Firebase CLI once if you don't have it: `npm install -g firebase-tools`.

```bash
firebase login
firebase init firestore   # point it at firestore.rules and firestore.indexes.json already in this repo
firebase deploy --only firestore:rules,firestore:indexes
```

(Or paste the contents of `firestore.rules` directly into the **Rules** tab of
Firestore in the Firebase console — same effect, no CLI needed.)

Without this step the database defaults are locked down and nothing will read or write.

## 6. Run it

```bash
npm run dev
```

Open the printed local URL. To test realtime sync between two "students," open the
same URL in a second browser profile or an incognito window — each gets its own
anonymous account automatically.

## 7. Deploy it somewhere your class can reach

Any static host works (Vercel, Netlify, Firebase Hosting, GitHub Pages):

```bash
npm run build
# then, for Firebase Hosting:
firebase init hosting   # set the public directory to "dist"
firebase deploy --only hosting
```

Once deployed, students can open the link on their phone and use **Add to Home
Screen** — the app is installable (PWA) and will behave like a native app icon.

## Project structure

```
src/
  firebase/       Firestore/Auth service functions + Cloudinary upload helper
  types/          Shared TypeScript types
  data/           Static reference data (default subjects, category metadata)
  context/        Auth, Theme (light/dark/system), Toast providers
  hooks/          Realtime listeners as React hooks (usePlannerDay, useMessages, ...)
  components/     UI, grouped by feature (planner, chat, profile, notes, layout, shared)
  pages/          The four tabs: Planner, Upcoming, Chat, Profile
firestore.rules   Firestore Security Rules — validates field lengths, ownership, categories
firestore.indexes.json  Composite indexes required by the Upcoming tab and My Notes queries
```

## What's implemented

- Anonymous auth, auto-created profile ("Student 247"), editable name/photo/status
- Daily planner with 6 categories (Bring, Reading, Homework, Test, Project, Important),
  default + custom subjects, add/edit/soft-delete with undo, per-student completion checkmarks
- Upcoming tab grouped by day, prioritizing tests/projects/important items
- Class chat: text, images (compressed client-side, uploaded to Cloudinary), replies, emoji
  reactions, delete-your-own-message, report button, basic word filter + client-side rate limiting
- Announcements strip on the planner + a composer any student can post from
- Private "My Notes" (Firestore-rule-enforced — only the owner can ever read their own notes)
- Light/dark/system theme, offline banner, skeleton loading states, empty states
- Installable PWA with app icons and manifest
- Firestore Security Rules enforcing field limits, ownership, and allowed categories

## Known limitations / good next steps

- The client-side word filter (`src/utils/moderation.ts`) is intentionally small — expand
  the list for your class, or swap in a moderation API if you need something stronger.
- Presence ("N students active") is approximate — it's based on a `lastSeen` timestamp
  updated on load, not a true realtime presence system (which needs Realtime Database).
- Chat pagination loads the most recent 30 messages; `loadOlderMessages` in
  `src/firebase/chat.ts` is ready to wire up to a "load older" button if history grows long.
- The Cloudinary unsigned preset doesn't enforce per-user write ownership the way Firebase
  Storage rules would — anyone with the preset name could technically upload through it.
  For a small trusted class this is a low risk; the file-size/format cap in the preset
  settings covers the main abuse case.
- This was built and type-checked in a sandboxed environment without live Firebase or
  Cloudinary credentials, so realtime sync across devices hasn't been tested end-to-end
  against a real project — do the two-browser test in step 6 above before rolling it out.

## Voice calls — free TURN server setup (Metered.ca)

Voice calls use WebRTC. STUN alone (free, built in) connects most calls, but calls
between two phones on different mobile networks often need a TURN relay. Free tier,
no credit card:

1. Go to [metered.ca](https://www.metered.ca) → sign up (free).
2. Create an app → open the **TURN Server** section of the dashboard.
3. Copy the credentials it shows: the TURN URLs, username, and credential/password.
4. Add them to your `.env` (and to Vercel's Environment Variables):
   ```
   VITE_TURN_URL=turn:your-region.metered.live:80,turn:your-region.metered.live:443
   VITE_TURN_USERNAME=<your username>
   VITE_TURN_CREDENTIAL=<your credential>
   ```
   (VITE_TURN_URL accepts a comma-separated list — paste all the turn: URLs Metered gives you.)

If you leave these blank, calls fall back to STUN-only automatically — they'll still
work on the same network / WiFi, just less reliably across mobile data.

## What Phase 3 added

- **Reels** — vertical swipe video feed, upload with 60s/30MB/MP4 limits, autoplay the
  reel in view, mute toggle, like, comment, share into chats, delete your own.
- **Voice/video Stories** — stories now accept short videos (max 30s) as well as images.
- **1:1 & group voice calls** — audio-only WebRTC. Call button in any chat header.
  Incoming-call screen with ringtone (when the app is open), mute, call duration, group
  participant list with mute indicators, leave/end.
- **In-app Notification Center** — bell on Home with unread badge, read/unread, mark all
  read, clear, click-to-navigate. DMs and group messages generate notifications.
- **Notification permission prompt** — a friendly explanation appears after a few seconds
  (not instantly), then requests browser permission. Background browser notifications fire
  when the tab is hidden.

## Honest limitations (read before relying on these)

- **Group voice calls** use a peer-to-peer mesh. This works for small groups (3-4 people)
  but gets unreliable beyond that on mobile browsers — that's a fundamental WebRTC-mesh
  limitation, not a bug. Reliable large group calls need a paid media server (SFU).
- **Calls when the app is fully closed**: web browsers (especially iOS Safari) can't
  reliably wake a closed app to ring like a native phone app. Incoming-call UI + ringtone
  work when the app is open or backgrounded; a fully-terminated browser may not ring. This
  is a platform limitation acknowledged up front.
- **iOS Safari** is the fussiest platform for both microphone recording and WebRTC — test
  on a real iPhone before relying on voice features there.
