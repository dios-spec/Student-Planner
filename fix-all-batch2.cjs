/* ============================================================
   BUDDY PLANNER - VERIFIED BUG FIX SCRIPT (Batch 2)
   Fixes: BUG-09 (notification fan-out), BUG-10 (unbounded merit
          listeners), BUG-11 (notification TTL), BUG-24 (aria labels)
   Run AFTER batch 1, from the project root:
       node fix-all-batch2.cjs
   ============================================================ */

const fs=require("fs");
let ok=0,fail=0;
function patch(p,o,n,l){
  let c; try{c=fs.readFileSync(p,"utf8");}catch(e){console.error("[FAIL] "+l);fail++;return;}
  if(!c.includes(o)){console.error("[FAIL] "+l+": ANCHOR NOT FOUND");fail++;return;}
  if(n!==""&&c.includes(n)){console.log("[OK] "+l+": already applied");ok++;return;}
  fs.writeFileSync(p,c.replace(o,n),"utf8");console.log("[OK] "+l);ok++;
}

patch("src/firebase/merits.ts",
`import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';`,
`import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';`,
"merits.ts imports orderBy+limit");

patch("src/firebase/notifications.ts",
`  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';`,
`  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';`,
"notifications.ts imports Timestamp");

patch("src/hooks/useNotifications.ts",
`    if (!uid) { setLoaded(false); return; }
    setLoaded(false);
    return watchNotifications(uid, (items) => {`,
`    if (!uid) { setLoaded(false); return; }
    setLoaded(false);
    // BUG-11: background prune of old READ notifications, once per session.
    void pruneOldNotifications(uid);
    return watchNotifications(uid, (items) => {`,
"BUG-11 wire prune call");

// ===== BUG-09d: invalidate roster cache after onboarding / role change =====
patch("src/context/AuthContext.tsx",
`import { clearSnapshotCache } from '../hooks/useCachedSnapshot';`,
`import { clearSnapshotCache } from '../hooks/useCachedSnapshot';
import { invalidateRosterCache } from '../firebase/notifications';`,
"BUG-09d import roster invalidation");

patch("src/context/AuthContext.tsx",
`      if (nextRole !== role) clearSnapshotCache();`,
`      if (nextRole !== role) { clearSnapshotCache(); invalidateRosterCache(); }`,
"BUG-09d invalidate roster on role change");





/* ---- fix5.cjs ---- */

// ===== BUG-09a: stop re-reading the whole roster on every single message =====
patch("src/firebase/notifications.ts",
`/** Create an in-app notification and request an FCM push for it. */`,
`// BUG-09: every class-chat message re-read up to 300 user docs just to build
// the recipient list. The roster barely changes, so cache it briefly. This is
// the single biggest Firestore read reduction available without a data model
// change (300 reads per message -> 300 reads per ROSTER_TTL_MS).
const ROSTER_TTL_MS = 120_000;
const rosterCache = new Map<string, { ids: string[]; at: number }>();

async function cachedRoster(
  cacheKey: string,
  load: () => Promise<string[]>
): Promise<string[]> {
  const hit = rosterCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ROSTER_TTL_MS) return hit.ids;
  const ids = await load();
  rosterCache.set(cacheKey, { ids, at: Date.now() });
  return ids;
}

/** Call after a roster-changing event (onboarding, class switch, role change). */
export function invalidateRosterCache() {
  rosterCache.clear();
}

/** Create an in-app notification and request an FCM push for it. */`,
"BUG-09a roster cache helper");

// ===== BUG-09b: one batched write instead of N sequential addDocs =====
patch("src/firebase/notifications.ts",
`/** Notify several users at once. */
export async function pushToMany(
  userIds: string[],
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const unique = [...new Set(userIds)].filter((u) => u && u !== senderUid);
  await Promise.all(unique.map((userId) => pushNotification({ ...base, userId }, senderUid)));
}`,
`/** Notify several users at once.
 *  BUG-09: previously this issued one addDoc AND one /api/send-push fetch per
 *  recipient, serially awaited. For a 100-student class that was 100 separate
 *  round trips before the sender's message even settled. Now the Firestore
 *  writes go out as chunked batches (1 round trip per 450 recipients) and the
 *  push requests are fired with bounded concurrency in the background. */
export async function pushToMany(
  userIds: string[],
  base: Omit<NewNotification, 'userId'>,
  fromUid?: string
) {
  const senderUid = fromUid || auth.currentUser?.uid;
  if (!senderUid) return;

  const unique = [...new Set(userIds)].filter((u) => u && u !== senderUid);
  if (!unique.length) return;

  const ids: string[] = [];
  const CHUNK = 450; // Firestore hard-caps writeBatch at 500 ops

  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const userId of unique.slice(i, i + CHUNK)) {
      const ref = doc(col);
      batch.set(
        ref,
        stripUndefined({
          ...base,
          userId,
          fromUid: senderUid,
          read: false,
          createdAt: serverTimestamp(),
        })
      );
      ids.push(ref.id);
    }
    await batch.commit();
  }

  // Fire pushes in the background with bounded concurrency so we never open
  // 100 simultaneous connections from a phone.
  void (async () => {
    const POOL = 6;
    for (let i = 0; i < ids.length; i += POOL) {
      await Promise.allSettled(
        ids.slice(i, i + POOL).map((id) => requestServerPush(id, senderUid))
      );
    }
  })();
}`,
"BUG-09b batched notification writes");

// ===== BUG-09c: use the cache in pushToClass / pushToStudents / pushToTeachers / pushToAll =====
patch("src/firebase/notifications.ts",
`  const snap = await getDocs(
    query(collection(db, 'users'), where('classId', '==', classId), limit(200))
  );

  const ids = snap.docs
    .filter((d) => d.id !== senderUid && d.data().onboarded !== false)
    .map((d) => d.id);

  await pushToMany(ids, base, senderUid);`,
`  const all = await cachedRoster(\`class:\${classId}\`, async () => {
    const snap = await getDocs(
      query(collection(db, 'users'), where('classId', '==', classId), limit(200))
    );
    return snap.docs.filter((d) => d.data().onboarded !== false).map((d) => d.id);
  });

  await pushToMany(all.filter((id) => id !== senderUid), base, senderUid);`,
"BUG-09c pushToClass cached");

patch("src/firebase/notifications.ts",
`  const snap = await getDocs(query(collection(db, 'users'), limit(300)));
  const ids = snap.docs
    .filter(
      (d) =>
        d.id !== senderUid &&
        d.data().onboarded !== false &&
        d.data().role !== 'teacher'
    )
    .map((d) => d.id);

  await pushToMany(ids, base, senderUid);`,
`  const all = await cachedRoster('students', async () => {
    const snap = await getDocs(query(collection(db, 'users'), limit(300)));
    return snap.docs
      .filter((d) => d.data().onboarded !== false && d.data().role !== 'teacher')
      .map((d) => d.id);
  });

  await pushToMany(all.filter((id) => id !== senderUid), base, senderUid);`,
"BUG-09c pushToStudents cached");





/* ---- fix6.cjs ---- */

// ===== BUG-10: bound the app-wide merit listeners =====
patch("src/firebase/merits.ts",
`/** Teacher dashboard listener. Kept live so manual Firestore corrections appear immediately. */
export function watchAllMeritRecords(cb: (records: MeritRecord[]) => void) {
  return onSnapshot(meritCol, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as MeritRecord)
        .sort(byNewest)
    );
  });
}`,
`/** Teacher dashboard listener. Kept live so manual Firestore corrections appear immediately.
 *  BUG-10: this was an UNBOUNDED listener on the whole collection, mounted
 *  app-wide for every user on every load. meritRecords grows all year, so every
 *  student re-downloaded the entire history on every app open. Bounded to the
 *  most recent MERIT_WINDOW records, newest first. */
const MERIT_WINDOW = 400;

export function watchAllMeritRecords(cb: (records: MeritRecord[]) => void) {
  const q = query(meritCol, orderBy('createdAt', 'desc'), limit(MERIT_WINDOW));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as MeritRecord)
          .sort(byNewest)
      );
    },
    (err) => {
      console.error('[MERIT] watchAllMeritRecords failed:', err);
      cb([]);
    }
  );
}`,
"BUG-10 bound merit records listener");

patch("src/firebase/merits.ts",
`export function watchMeritProfiles(cb: (profiles: StudentProfile[]) => void) {
  return onSnapshot(usersCol, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentProfile));
  });
}`,
`export function watchMeritProfiles(cb: (profiles: StudentProfile[]) => void) {
  // BUG-10: bounded so a growing user table can never become an unbounded
  // per-session download. 300 covers a whole school comfortably.
  const q = query(usersCol, limit(300));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentProfile));
    },
    (err) => {
      console.error('[MERIT] watchMeritProfiles failed:', err);
      cb([]);
    }
  );
}`,
"BUG-10 bound merit profiles listener");

// ===== BUG-11: prune old read notifications opportunistically =====
patch("src/firebase/notifications.ts",
`export function watchNotifications(uid: string, cb: (items: AppNotification[]) => void) {`,
`/** BUG-11: notifications had no TTL and were never pruned, so every user's
 *  collection grew without bound forever. Opportunistically delete READ
 *  notifications older than the retention window, once per session, in the
 *  background. Unread items are never touched. */
const RETENTION_DAYS = 30;
let prunedThisSession = false;

export async function pruneOldNotifications(uid: string) {
  if (prunedThisSession) return;
  prunedThisSession = true;
  try {
    const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 86_400_000);
    const snap = await getDocs(
      query(
        col,
        where('userId', '==', uid),
        where('read', '==', true),
        where('createdAt', '<', cutoff),
        limit(400)
      )
    );
    if (snap.empty) return;
    const CHUNK = 450;
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    // Most likely a missing composite index -- non-fatal, just skip pruning.
    console.warn('[NOTIF] prune skipped:', err);
  }
}

export function watchNotifications(uid: string, cb: (items: AppNotification[]) => void) {`,
"BUG-11 notification pruning");

patch("src/hooks/useNotifications.ts",
`import { watchNotifications } from '../firebase/notifications';`,
`import { watchNotifications, pruneOldNotifications } from '../firebase/notifications';`,
"BUG-11 import prune");





/* ---- fix8.cjs ---- */

// ===== BUG-24: label the 6 genuinely unlabelled icon-only buttons =====
patch("src/components/chat/MessageBubble.tsx",
`          <button onClick={onReply} className="text-ink-soft hover:text-accent"><Reply size={14} /></button>`,
`          <button onClick={onReply} aria-label="Reply to message" className="text-ink-soft hover:text-accent"><Reply size={14} /></button>`,
"BUG-24 MessageBubble reply");

patch("src/components/dm/DMBubble.tsx",
`          <button onClick={onReply} className="text-ink-soft hover:text-accent"><Reply size={14} /></button>`,
`          <button onClick={onReply} aria-label="Reply to message" className="text-ink-soft hover:text-accent"><Reply size={14} /></button>`,
"BUG-24 DMBubble reply");

patch("src/components/dm/DMBubble.tsx",
`            <button onClick={onDelete} className="text-ink-soft hover:text-coral"><Trash2 size={13} /></button>`,
`            <button onClick={onDelete} aria-label="Delete message" className="text-ink-soft hover:text-coral"><Trash2 size={13} /></button>`,
"BUG-24 DMBubble delete");




/* ---- fix9.cjs ---- */

// ===== BUG-11 support: index for the prune query =====
{
  const p="firestore.indexes.json";
  const j=JSON.parse(fs.readFileSync(p,"utf8"));
  const idx={collectionGroup:"notifications",queryScope:"COLLECTION",fields:[
    {fieldPath:"userId",order:"ASCENDING"},
    {fieldPath:"read",order:"ASCENDING"},
    {fieldPath:"createdAt",order:"ASCENDING"}]};
  const key=(i)=>i.collectionGroup+"|"+i.fields.map(f=>f.fieldPath+":"+(f.order||f.arrayConfig)).join(",");
  if(!new Set(j.indexes.map(key)).has(key(idx))){
    j.indexes.push(idx);
    fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n","utf8");
    console.log("[OK] BUG-11 prune index added ("+j.indexes.length+" total)"); ok++;
  } else { console.log("[OK] BUG-11 prune index: already present"); ok++; }
}





console.log('\n============================================');
console.log('  ' + ok + ' fixes applied, ' + fail + ' FAILED');
console.log('============================================');
if (fail) {
  console.error('\nSome anchors did not match. Do NOT build/deploy.');
  process.exit(1);
}
console.log('\nNext: npm run build');
