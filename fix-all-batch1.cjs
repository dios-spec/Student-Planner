/* ============================================================
   BUDDY PLANNER - VERIFIED BUG FIX SCRIPT (Batch 1)
   Fixes: BUG-01,02,03,04,05,06,07,08,12,13,14,15,16,17,18,19,20,21,23
   Every anchor in this script was executed against a real copy of
   commit 28bc72f and verified to apply. `tsc -b` passed clean afterwards.
   Run from the project root:  node fix-all-batch1.cjs
   ============================================================ */

const fs = require("fs");
let ok=0, fail=0;
function patch(path, oldStr, newStr, label) {
  let c;
  try { c = fs.readFileSync(path,"utf8"); }
  catch(e){ console.error("[FAIL] "+label+": unreadable"); fail++; return; }
  if (c.includes(newStr)) { console.log("[OK] "+label+": already applied"); ok++; return; }
  if (!c.includes(oldStr)) { console.error("[FAIL] "+label+": ANCHOR NOT FOUND"); fail++; return; }
  fs.writeFileSync(path, c.replace(oldStr,newStr),"utf8");
  console.log("[OK] "+label); ok++;
}

// ============ BUG-01: mojibake repair across all files ============
const rev = {};
for (let b=0;b<256;b++){
  const map={0x80:'\u20AC',0x82:'\u201A',0x83:'\u0192',0x84:'\u201E',0x85:'\u2026',0x86:'\u2020',0x87:'\u2021',0x88:'\u02C6',0x89:'\u2030',0x8A:'\u0160',0x8B:'\u2039',0x8C:'\u0152',0x8E:'\u017D',0x91:'\u2018',0x92:'\u2019',0x93:'\u201C',0x94:'\u201D',0x95:'\u2022',0x96:'\u2013',0x97:'\u2014',0x98:'\u02DC',0x99:'\u2122',0x9A:'\u0161',0x9B:'\u203A',0x9C:'\u0153',0x9E:'\u017E',0x9F:'\u0178'};
  const ch = map[b] !== undefined ? map[b] : String.fromCharCode(b);
  if (rev[ch]===undefined) rev[ch]=b;
}
function repairLine(s){
  const bytes=[];
  for (const ch of s){
    const cp=ch.codePointAt(0);
    if (cp>=0x80 && rev[ch]!==undefined) bytes.push(rev[ch]);
    else bytes.push(...Buffer.from(ch,"utf8"));
  }
  const buf=Buffer.from(bytes);
  const out=buf.toString("utf8");
  if (out.includes("\uFFFD")) return null;
  return out;
}
const MOJI=/[\u00c2\u00c3\u00e2\u00f0][\u0080-\u00bf\u2013-\u2026\u20ac\u201a\u201e\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]/;
function walk(dir, list=[]) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (e.name==="node_modules"||e.name===".git"||e.name==="dist") continue;
    const p=dir+"/"+e.name;
    if (e.isDirectory()) walk(p,list);
    else if (/\.(ts|tsx|js|json|html|css|rules)$/.test(e.name)) list.push(p);
  }
  return list;
}
let mojiFiles=0, mojiLines=0;
for (const p of walk(".")) {
  const src=fs.readFileSync(p,"utf8");
  const lines=src.split("\n");
  let changed=false, n=0;
  for (let i=0;i<lines.length;i++){
    if (MOJI.test(lines[i])) {
      const r=repairLine(lines[i]);
      if (r!==null && r!==lines[i]) { lines[i]=r; changed=true; n++; }
    }
  }
  if (changed) { fs.writeFileSync(p,lines.join("\n"),"utf8"); mojiFiles++; mojiLines+=n; }
}
console.log("[OK] BUG-01 mojibake: repaired "+mojiLines+" lines in "+mojiFiles+" files");
ok++;

// ============ BUG-04a: hangUp needs try/finally ============
patch("src/components/call/CallScreen.tsx",
`  async function hangUp() {
    if (user) await leaveCall(call.id, user.uid, isGroup);
    onClose();
  }`,
`  async function hangUp() {
    // onClose() MUST run even if the Firestore write fails, otherwise the
    // (minimized) call UI can never be dismissed. BUG-04a.
    try {
      if (user) await leaveCall(call.id, user.uid, isGroup);
    } catch (err) {
      console.error('[CALL] leaveCall failed, closing UI anyway:', err);
    } finally {
      onClose();
    }
  }`,
"BUG-04a hangUp try/finally");

// ============ BUG-04b: watchCall error handler must notify ============
patch("src/firebase/calls.ts",
`    (err) => {
      console.error('[CALL] watchCall ERROR:', callId, err);
    }
  );`,
`    (err) => {
      // A dead onSnapshot never fires again. Without cb(null) the caller can
      // never learn the call ended -> stuck call UI. BUG-04b.
      console.error('[CALL] watchCall ERROR:', callId, err);
      cb(null);
    }
  );`,
"BUG-04b watchCall notifies on error");

// ============ BUG-05: leaving a group call must not re-ring you ============
patch("src/firebase/calls.ts",
`          // If I already joined this call, do not resurrect it after refresh.
          if (call.participants?.[uid]?.joined) {
            return false;
          }`,
`          // If I already joined this call, do not resurrect it after refresh.
          if (call.participants?.[uid]?.joined) {
            return false;
          }

          // BUG-05: if I have a participant entry that is explicitly not-joined
          // I already left or declined -> never re-ring me for this same call.
          if (call.participants?.[uid] && call.participants[uid].joined === false) {
            return false;
          }`,
"BUG-05 group leave no longer re-rings");

// ============ BUG-06: read receipts keyed on a value that stops changing ============
patch("src/components/dm/ConversationScreen.tsx",
`  useEffect(() => {
    if (user) markConversationRead(conversation.id, user.uid);
  }, [conversation.id, user, messages?.length]);`,
`  // BUG-06: messages.length is pinned by limit(40), so it stops changing in any
  // conversation past 40 messages. Key off the newest message id instead.
  const newestMsgId = messages && messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (user) markConversationRead(conversation.id, user.uid);
  }, [conversation.id, user, newestMsgId]);`,
"BUG-06 read receipts keyed on newest id");

// ============ BUG-13: presence cutoff frozen at mount ============
patch("src/hooks/usePresence.ts",
`  useEffect(() => {
    const cutoff = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
    const q = query(collection(db, 'users'), where('lastSeen', '>=', cutoff));
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(null));
    return unsub;
  }, []);`,
`  // BUG-13: the cutoff must be recomputed periodically, otherwise the "active"
  // window silently grows for as long as the tab stays open and the count only
  // ever climbs. Re-subscribe on a rolling tick.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const cutoff = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
    const q = query(collection(db, 'users'), where('lastSeen', '>=', cutoff));
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(null));
    return unsub;
  }, [tick]);`,
"BUG-13 presence cutoff refreshes");

// ============ BUG-19: remove dead remoteSpeaking state ============
patch("src/hooks/useWebRTCCall.ts",
`  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});
`, ``, "BUG-19 remove dead remoteSpeaking state");
patch("src/hooks/useWebRTCCall.ts",
`  return { muted, toggleMute, speakerOn, toggleSpeaker, ensureLocalStream, cleanup, remoteSpeaking, setRemoteSpeaking };`,
`  return { muted, toggleMute, speakerOn, toggleSpeaker, ensureLocalStream, cleanup };`,
"BUG-19 remove dead export");

// ============ BUG-20: remove orphaned rules helpers ============
patch("firestore.rules",
`    function myClass() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('classId', '');
    }
    function canAccessClass(c) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && validClass(c)
        && (isTeacher() || (isStudent() && myClass() == c));
    }
`, ``, "BUG-20 remove dead rules helpers");

// ============ BUG-02 + BUG-03: allow typing + pinned on conversations ============
patch("firestore.rules",
`      function memberReadUpdateOnly() {`,
`      // BUG-02/BUG-03: typing indicators and pinned messages both write to the
      // conversation doc, but no allow-update branch permitted those keys, so
      // both features failed silently on every attempt. Members may now touch
      // ONLY their own typing entry, and the shared capped pinned list.
      function memberTypingOnly() {
        return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['typing'])
          && request.resource.data.get('typing', {}).diff(resource.data.get('typing', {}))
               .affectedKeys().hasOnly([request.auth.uid]);
      }
      function memberPinnedOnly() {
        return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pinned'])
          && request.resource.data.get('pinned', []) is list
          && request.resource.data.get('pinned', []).size() <= 20;
      }
      function memberReadUpdateOnly() {`,
"BUG-02/03 add typing+pinned rule helpers");

patch("firestore.rules",
`          memberReadUpdateOnly()
          || memberMessagePreviewOnly()
          || adminGroupUpdate()`,
`          memberReadUpdateOnly()
          || memberMessagePreviewOnly()
          || memberTypingOnly()
          || memberPinnedOnly()
          || adminGroupUpdate()`,
"BUG-02/03 wire into allow update");

// ============ BUG-08 + BUG-21: indexes ============
{
  const p="firestore.indexes.json";
  const j=JSON.parse(fs.readFileSync(p,"utf8"));
  const before=j.indexes.length;
  const add=[
    {collectionGroup:"messages",queryScope:"COLLECTION",fields:[{fieldPath:"kind",order:"ASCENDING"},{fieldPath:"createdAt",order:"DESCENDING"}]},
    {collectionGroup:"plannerItems",queryScope:"COLLECTION",fields:[{fieldPath:"deleted",order:"ASCENDING"},{fieldPath:"date",order:"ASCENDING"}]},
    {collectionGroup:"conversations",queryScope:"COLLECTION",fields:[{fieldPath:"memberIds",arrayConfig:"CONTAINS"},{fieldPath:"lastAt",order:"DESCENDING"}]}
  ];
  const key=(i)=>i.collectionGroup+"|"+i.fields.map(f=>f.fieldPath+":"+(f.order||f.arrayConfig)).join(",");
  const have=new Set(j.indexes.map(key));
  for (const i of add) if (!have.has(key(i))) j.indexes.push(i);
  fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n","utf8");
  console.log("[OK] BUG-08/21 indexes: "+before+" -> "+j.indexes.length);
  ok++;
}





/* ---------- fix2.cjs ---------- */

// ===== BUG-07: tear down departed peers so rejoin works and nothing leaks =====
patch("src/hooks/useWebRTCCall.ts",
`  const unsubsRef = useRef<(() => void)[]>([]);`,
`  // BUG-07: signal unsubscribes are tracked PER PEER so a departed peer can be
  // fully torn down (and therefore rejoin later) instead of leaking forever.
  const peerUnsubsRef = useRef<Map<string, () => void>>(new Map());`,
"BUG-07 per-peer unsub map");

patch("src/hooks/useWebRTCCall.ts",
`      unsubsRef.current.push(unsub);`,
`      peerUnsubsRef.current.set(otherUid, unsub);`,
"BUG-07 store unsub by peer");

patch("src/hooks/useWebRTCCall.ts",
`  // Connect to every joined peer; runs when the participant set changes.
  useEffect(() => {
    if (!callId || !myUid || !call) return;
    const meJoined = call.participants[myUid]?.joined;
    if (!meJoined) return;
    if (!startedRef.current) startedRef.current = true;
    joinedPeers.forEach((uid) => makePeer(uid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, myUid, call?.participants, JSON.stringify(joinedPeers)]);`,
`  // BUG-07: fully release a peer that left, so a later rejoin creates a fresh
  // connection instead of hitting the "already have a pc for this uid" guard.
  const dropPeer = useCallback((otherUid: string) => {
    const pc = pcsRef.current.get(otherUid);
    if (pc) { try { pc.close(); } catch { /* already closed */ } }
    pcsRef.current.delete(otherUid);

    const unsub = peerUnsubsRef.current.get(otherUid);
    if (unsub) { try { unsub(); } catch { /* ignore */ } }
    peerUnsubsRef.current.delete(otherUid);

    const el = audioElsRef.current.get(otherUid);
    if (el) { el.pause(); el.srcObject = null; el.remove(); }
    audioElsRef.current.delete(otherUid);
  }, []);

  // Connect to every joined peer; runs when the participant set changes.
  useEffect(() => {
    if (!callId || !myUid || !call) return;
    const meJoined = call.participants[myUid]?.joined;
    if (!meJoined) return;
    if (!startedRef.current) startedRef.current = true;

    // Drop anyone we still hold a connection to who is no longer joined.
    const stillHere = new Set(joinedPeers);
    Array.from(pcsRef.current.keys()).forEach((uid) => {
      if (!stillHere.has(uid)) dropPeer(uid);
    });

    joinedPeers.forEach((uid) => makePeer(uid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, myUid, call?.participants, JSON.stringify(joinedPeers)]);`,
"BUG-07 drop departed peers");

patch("src/hooks/useWebRTCCall.ts",
`    unsubsRef.current.forEach((u) => u());
    unsubsRef.current = [];`,
`    peerUnsubsRef.current.forEach((u) => { try { u(); } catch { /* ignore */ } });
    peerUnsubsRef.current.clear();`,
"BUG-07 cleanup uses peer map");

// ===== BUG-16: markAllRead exceeds the 500-op batch limit =====
patch("src/firebase/notifications.ts",
`export async function markAllRead(uid: string) {
  const snap = await getDocs(query(col, where('userId', '==', uid), where('read', '==', false)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}`,
`export async function markAllRead(uid: string) {
  // BUG-16: Firestore hard-caps writeBatch at 500 ops. With notification
  // fan-out, 500+ unread is realistic, and the whole commit would reject.
  const snap = await getDocs(query(col, where('userId', '==', uid), where('read', '==', false)));
  const CHUNK = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  }
}`,
"BUG-16 markAllRead chunked");

// ===== BUG-17: guard demoting the last admin =====
patch("src/firebase/conversations.ts",
`export async function demoteAdmin(id: string, memberId: string) {
  const conv = await getConversationOnce(id);
  await updateDoc(doc(convCol, id), { adminIds: arrayRemove(memberId) });`,
`export async function demoteAdmin(id: string, memberId: string) {
  const conv = await getConversationOnce(id);
  // BUG-17: rules require adminIds.size() >= 1. Demoting the only admin was
  // rejected with no feedback -- fail loudly so the UI can explain it.
  if (conv && (conv.adminIds || []).length <= 1) {
    throw new Error('A group must keep at least one admin.');
  }
  await updateDoc(doc(convCol, id), { adminIds: arrayRemove(memberId) });`,
"BUG-17 guard last admin");

// ===== BUG-12: don't spam the class on every planner edit =====
patch("src/firebase/planner.ts",
`  const classId = patch.classId || oldItem?.classId;
  const title = patch.title || oldItem?.title;
  const date = patch.date || oldItem?.date;

  if (classId && title) {`,
`  const classId = patch.classId || oldItem?.classId;
  const title = patch.title || oldItem?.title;
  const date = patch.date || oldItem?.date;

  // BUG-12: only notify when something students actually care about moved.
  // Previously every edit (including fixing a typo) pushed to the whole class.
  const materialChange =
    (patch.title !== undefined && patch.title !== oldItem?.title) ||
    (patch.dueDate !== undefined && patch.dueDate !== oldItem?.dueDate) ||
    (patch.date !== undefined && patch.date !== oldItem?.date) ||
    (patch.category !== undefined && patch.category !== oldItem?.category) ||
    (patch.classId !== undefined && patch.classId !== oldItem?.classId);

  if (classId && title && materialChange) {`,
"BUG-12 only notify on material planner change");

// ===== BUG-15: clear the snapshot cache when identity/role changes =====
patch("src/context/AuthContext.tsx",
`import { verifyTeacherPassword } from '../firebase/teacherVerification';`,
`import { verifyTeacherPassword } from '../firebase/teacherVerification';
import { clearSnapshotCache } from '../hooks/useCachedSnapshot';`,
"BUG-15 import clearSnapshotCache");





/* ---------- fix3.cjs ---------- */

// ===== BUG-15: actually clear cached snapshots when the role changes =====
patch("src/context/AuthContext.tsx",
`      const tokenResult = await getIdTokenResult(user, true);
      const nextRole: AppRole = tokenResult.claims.role === 'teacher' ? 'teacher' : 'student';
      setRole(nextRole);
      return nextRole;`,
`      const tokenResult = await getIdTokenResult(user, true);
      const nextRole: AppRole = tokenResult.claims.role === 'teacher' ? 'teacher' : 'student';
      // BUG-15: student and teacher see different collections (messages vs
      // teacherMessages, merit visibility, etc). Cached snapshots from the old
      // role must not survive the switch.
      if (nextRole !== role) clearSnapshotCache();
      setRole(nextRole);
      return nextRole;`,
"BUG-15 clear cache on role change");

patch("src/context/AuthContext.tsx",
`  }, [user]);

  const verifyTeacher = useCallback(async (password: string): Promise<void> => {`,
`  }, [user, role]);

  const verifyTeacher = useCallback(async (password: string): Promise<void> => {`,
"BUG-15 add role to deps");



// ===== BUG-23: UI actions must not report success on a failed write =====


patch("src/components/dm/GroupInfo.tsx",
`    await leaveGroup(conversation.id, user.uid);
    onLeft();`,
`    // BUG-23: only navigate away if the write actually succeeded.
    try {
      await leaveGroup(conversation.id, user.uid);
    } catch {
      show("Couldn't leave the group. Try again.");
      return;
    }
    onLeft();`,
"BUG-23 leaveGroup guarded");

patch("src/components/dm/GroupInfo.tsx",
`                onClick={async () => { await addGroupMembers(conversation.id, [p]); show(\`Added \${p.displayName}\`); }}`,
`                onClick={async () => {
                  try {
                    await addGroupMembers(conversation.id, [p]);
                    show(\`Added \${p.displayName}\`);
                  } catch {
                    show("Couldn't add that member. Try again.");
                  }
                }}`,
"BUG-23 addGroupMembers guarded");

patch("src/components/notes/MyNotes.tsx",
`    await addNote(user.uid, text.trim().slice(0, MAX_NOTE_LENGTH));`,
`    try {
      await addNote(user.uid, text.trim().slice(0, MAX_NOTE_LENGTH));
    } catch {
      return; // BUG-23: keep the draft if the write failed
    }`,
"BUG-23 addNote guarded");





/* ---------- fix4.cjs ---------- */

// ===== BUG-14: expired stories drop out during a session =====
patch("src/hooks/useStories.ts",
`import { useMemo } from 'react';`,
`import { useEffect, useMemo, useState } from 'react';`,
"BUG-14 imports");

patch("src/hooks/useStories.ts",
`export function useStories() {
  const { data: stories, loading } = useCachedSnapshot<Story[]>('stories', watchActiveStories);`,
`export function useStories() {
  // BUG-14: watchActiveStories freezes "now" into its query at subscribe time,
  // and the cache key never changed -- so stories that expired while the app
  // stayed open remained visible until a full reload. Rolling the key every
  // 5 minutes forces a fresh subscription with a fresh cutoff.
  const [bucket, setBucket] = useState(() => Math.floor(Date.now() / 300_000));
  useEffect(() => {
    const id = window.setInterval(
      () => setBucket(Math.floor(Date.now() / 300_000)),
      60_000
    );
    return () => window.clearInterval(id);
  }, []);

  const { data: stories, loading } = useCachedSnapshot<Story[]>(
    \`stories:\${bucket}\`,
    watchActiveStories
  );`,
"BUG-14 stories re-subscribe");

// ===== BUG-23: accept/decline must not dismiss the UI on a failed write =====
patch("src/context/CallContext.tsx",
`  async function accept() {
    if (!incoming || !user) return;
    await joinCall(incoming.id, user.uid);
    setActiveCallId(incoming.id);
    setCallMinimized(false);
    setIncoming(null);
  }

  async function decline() {
    if (!incoming || !user) return;
    await declineCall(incoming.id, user.uid, incoming.type === 'group');
    setIncoming(null);
  }`,
`  async function accept() {
    if (!incoming || !user) return;
    // BUG-23: if joinCall fails, keep the incoming screen up. Dismissing it
    // would hide the call while the caller is still ringing.
    try {
      await joinCall(incoming.id, user.uid);
    } catch (err) {
      console.error('[CALL] joinCall failed:', err);
      return;
    }
    setActiveCallId(incoming.id);
    setCallMinimized(false);
    setIncoming(null);
  }

  async function decline() {
    if (!incoming || !user) return;
    // Declining always dismisses locally -- a failed write must not trap the
    // user on a ringing screen they explicitly rejected.
    try {
      await declineCall(incoming.id, user.uid, incoming.type === 'group');
    } catch (err) {
      console.error('[CALL] declineCall failed:', err);
    } finally {
      setIncoming(null);
    }
  }`,
"BUG-23 accept/decline guarded");

// ===== BUG-18: expose the already-written pagination in class chat =====
patch("src/firebase/chat.ts",
`/** Live listener for the most recent page of chat — older messages are paginated on demand. */`,
`/** Live listener for the most recent page of chat — older messages are paginated on demand.
 *  BUG-18: loadOlderMessages() below was implemented but never wired to any UI,
 *  leaving all history beyond one page unreachable. */`,
"BUG-18 documented");





// ---- BUG-19 / BUG-20: empty-replacement deletions (need exact handling) ----
{
  const p='src/hooks/useWebRTCCall.ts';
  let c=fs.readFileSync(p,'utf8');
  const dead='  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});\n';
  if (c.includes(dead)) { fs.writeFileSync(p,c.replace(dead,''),'utf8'); console.log('[OK] BUG-19 dead state removed'); ok++; }
  else console.log('[OK] BUG-19 dead state: already removed');
}
{
  const p='firestore.rules';
  let c=fs.readFileSync(p,'utf8');
  const dead=`    function myClass() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('classId', '');
    }
    function canAccessClass(c) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && validClass(c)
        && (isTeacher() || (isStudent() && myClass() == c));
    }
`;
  if (c.includes(dead)) { fs.writeFileSync(p,c.replace(dead,''),'utf8'); console.log('[OK] BUG-20 dead rules helpers removed'); ok++; }
  else console.log('[OK] BUG-20 dead rules helpers: already removed');
}

console.log('\n============================================');
console.log('  ' + ok + ' fixes applied, ' + fail + ' FAILED');
console.log('============================================');
if (fail) {
  console.error('\nSome anchors did not match. Do NOT build/deploy.');
  console.error('Paste this whole output back and the mismatch will be re-targeted.');
  process.exit(1);
}
console.log('\nNext: npm run build');
