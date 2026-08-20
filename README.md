# Buddy Planner 📚

A student planner + class chat, built so a group of classmates can open one link and
instantly see homework, reading, tests, projects, things to bring, and announcements —
plus a live chat, with no sign-up.

No login screens, no passwords. Everyone gets an anonymous profile automatically and
data syncs live across every device through Firebase.

## Tech stack

React + TypeScript + Vite + Tailwind CSS v4 + Firebase (Auth, Firestore, Storage) + lucide-react.
No custom backend — Firebase is the only server-side piece, used purely for realtime sync.

## 1. Create your Firebase project (~5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Once created, click the **Web** icon (`</>`) to register a web app. Skip Firebase Hosting for now if you don't need it.
3. Copy the `firebaseConfig` values shown — you'll paste them into `.env` in step 3.
4. In the left sidebar:
   - **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
   - **Build → Firestore Database → Create database** (start in production mode — the included rules handle security).
   - **Build → Storage → Get started** (also production mode).

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

Paste your Firebase web config values into `.env`. These are safe to expose in a
frontend bundle (they identify your project, not secrets) — real protection comes
from the security rules in step 4.

## 4. Deploy the security rules

Install the Firebase CLI once if you don't have it: `npm install -g firebase-tools`.

```bash
firebase login
firebase init firestore storage   # point it at firestore.rules and storage.rules already in this repo
firebase deploy --only firestore:rules,storage:rules
```

(Or paste the contents of `firestore.rules` / `storage.rules` directly into the
**Rules** tab of Firestore/Storage in the Firebase console — same effect, no CLI needed.)

Without this step the database defaults are locked down and nothing will read or write.

## 5. Run it

```bash
npm run dev
```

Open the printed local URL. To test realtime sync between two "students," open the
same URL in a second browser profile or an incognito window — each gets its own
anonymous account automatically.

## 6. Deploy it somewhere your class can reach

Any static host works (Firebase Hosting, Vercel, Netlify, GitHub Pages):

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
  firebase/       Firestore/Storage/Auth service functions (the only place that talks to Firebase)
  types/          Shared TypeScript types
  data/           Static reference data (default subjects, category metadata)
  context/        Auth, Theme (light/dark/system), Toast providers
  hooks/          Realtime listeners as React hooks (usePlannerDay, useMessages, ...)
  components/     UI, grouped by feature (planner, chat, profile, notes, layout, shared)
  pages/          The four tabs: Planner, Upcoming, Chat, Profile
firestore.rules   Firestore Security Rules — validates field lengths, ownership, categories
storage.rules     Storage Security Rules — image type/size limits, per-user folders
```

## What's implemented

- Anonymous auth, auto-created profile ("Student 247"), editable name/photo/status
- Daily planner with 6 categories (Bring, Reading, Homework, Test, Project, Important),
  default + custom subjects, add/edit/soft-delete with undo, per-student completion checkmarks
- Upcoming tab grouped by day, prioritizing tests/projects/important items
- Class chat: text, images (compressed client-side before upload), replies, emoji reactions,
  delete-your-own-message, report button, basic word filter + client-side rate limiting
- Announcements strip on the planner + a composer any student can post from
- Private "My Notes" (Firestore-rule-enforced — only the owner can ever read their own notes)
- Light/dark/system theme, offline banner, skeleton loading states, empty states
- Installable PWA with app icons and manifest
- Firestore + Storage Security Rules enforcing field limits, ownership, and allowed categories

## Known limitations / good next steps

- The client-side word filter (`src/utils/moderation.ts`) is intentionally small — expand
  the list for your class, or swap in a moderation API if you need something stronger.
- Presence ("N students active") is approximate — it's based on a `lastSeen` timestamp
  updated on load, not a true realtime presence system (which needs Realtime Database).
- Chat pagination loads the most recent 30 messages; `loadOlderMessages` in
  `src/firebase/chat.ts` is ready to wire up to a "load older" button if history grows long.
- This was built and type-checked in a sandboxed environment without live Firebase
  credentials, so realtime sync across devices hasn't been tested end-to-end against a
  real project — do the two-browser test in step 5 above before rolling it out to your class.
