/* ============================================================
   BUDDY PLANNER - POLISH BATCH 4  (sound, haptics, chat history)
   Run AFTER batches 1-3, from the project root:
       node polish-batch4.cjs

   Adds:
     - src/utils/sfx.ts : synthesized UI sound layer (no audio assets)
     - send / receive / complete / reaction / select / error sounds
     - haptic feedback on mobile
     - honours the existing notificationSettings.sound preference
     - BUG-18: "Load earlier messages" in class chat (history was unreachable)
     - honest failure feedback when a message fails to send
   ============================================================ */
const fs = require("fs");
let ok = 0, fail = 0;
function patch(p, o, n, l) {
  let c;
  try { c = fs.readFileSync(p, "utf8"); }
  catch (e) { console.error("[FAIL] " + l + ": unreadable"); fail++; return; }
  if (!c.includes(o)) { console.error("[FAIL] " + l + ": ANCHOR NOT FOUND"); fail++; return; }
  if (n !== "" && c.includes(n)) { console.log("[OK] " + l + ": already applied"); ok++; return; }
  fs.writeFileSync(p, c.replace(o, n), "utf8");
  console.log("[OK] " + l); ok++;
}

// ---- write the new sound module ----

fs.writeFileSync('src/utils/sfx.ts', "/**\n * Tiny synthesized sound-effects layer.\n *\n * Deliberately uses the Web Audio API rather than audio files: no assets to\n * host, no Cloudinary quota, no extra network requests, and every sound stays\n * a few hundred bytes of code. Same approach as utils/ringtone.ts.\n *\n * Every sound is short, soft and low-gain on purpose -- this is a school app\n * used in classrooms, so the goal is a subtle tactile \"click\", never a jingle.\n *\n * Muting: reads the same `notificationSettings.sound` preference the call\n * ringtone respects, via setSfxEnabled() from AuthContext.\n */\n\nlet ctx: AudioContext | null = null;\nlet enabled = true;\nlet primed = false;\n\nfunction audioCtor(): typeof AudioContext | undefined {\n  if (typeof window === 'undefined') return undefined;\n  return (\n    window.AudioContext ||\n    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext\n  );\n}\n\n/** Called once from a real user gesture so browsers allow audio later. */\nexport function primeSfx() {\n  if (primed) return;\n  try {\n    const Ctor = audioCtor();\n    if (!Ctor) return;\n    if (!ctx || ctx.state === 'closed') ctx = new Ctor();\n    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});\n    primed = true;\n  } catch {\n    // Web Audio unavailable -- all sounds become silent no-ops.\n  }\n}\n\n/** Mirrors the user's notification sound preference. */\nexport function setSfxEnabled(next: boolean) {\n  enabled = next;\n}\n\n/** Short haptic pulse where the device supports it. Safe everywhere. */\nexport function haptic(pattern: number | number[] = 12) {\n  try {\n    navigator.vibrate?.(pattern);\n  } catch {\n    // unsupported -- ignore\n  }\n}\n\ninterface ToneSpec {\n  freq: number;\n  /** seconds from now */\n  at?: number;\n  /** seconds */\n  dur?: number;\n  /** peak gain, keep well under 0.1 for UI sounds */\n  gain?: number;\n  type?: OscillatorType;\n  /** optional linear glide target */\n  slideTo?: number;\n}\n\nfunction play(tones: ToneSpec[]) {\n  if (!enabled) return;\n  try {\n    if (!ctx || ctx.state === 'closed') primeSfx();\n    if (!ctx) return;\n    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});\n    if (ctx.state !== 'running') return;\n\n    const now = ctx.currentTime;\n    for (const t of tones) {\n      const start = now + (t.at ?? 0);\n      const dur = t.dur ?? 0.08;\n      const peak = t.gain ?? 0.05;\n\n      const osc = ctx.createOscillator();\n      const gain = ctx.createGain();\n      osc.type = t.type ?? 'sine';\n      osc.frequency.setValueAtTime(t.freq, start);\n      if (t.slideTo) osc.frequency.linearRampToValueAtTime(t.slideTo, start + dur);\n\n      // Quick attack, smooth decay -- avoids the click of a hard cutoff.\n      gain.gain.setValueAtTime(0, start);\n      gain.gain.linearRampToValueAtTime(peak, start + 0.012);\n      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);\n\n      osc.connect(gain);\n      gain.connect(ctx.destination);\n      osc.start(start);\n      osc.stop(start + dur + 0.02);\n    }\n  } catch {\n    // Never let a decorative sound break a real interaction.\n  }\n}\n\n/** Outgoing message -- soft upward blip. */\nexport function sfxSend() {\n  play([{ freq: 620, slideTo: 880, dur: 0.09, gain: 0.045 }]);\n  haptic(10);\n}\n\n/** Incoming message while you're looking at the chat -- softer, downward. */\nexport function sfxReceive() {\n  play([{ freq: 760, slideTo: 560, dur: 0.1, gain: 0.035 }]);\n}\n\n/** Task ticked off -- a small two-note \"done\" that feels rewarding. */\nexport function sfxComplete() {\n  play([\n    { freq: 660, dur: 0.09, gain: 0.05 },\n    { freq: 990, at: 0.075, dur: 0.13, gain: 0.055 },\n  ]);\n  haptic([14, 30, 18]);\n}\n\n/** Reaction / like -- tiny pop. */\nexport function sfxPop() {\n  play([{ freq: 900, slideTo: 1180, dur: 0.06, gain: 0.04, type: 'triangle' }]);\n  haptic(8);\n}\n\n/** Poll vote / selection confirmed. */\nexport function sfxSelect() {\n  play([{ freq: 520, dur: 0.05, gain: 0.035, type: 'triangle' }]);\n  haptic(8);\n}\n\n/** Something went wrong -- low, brief, not alarming. */\nexport function sfxError() {\n  play([\n    { freq: 300, dur: 0.11, gain: 0.05, type: 'sawtooth' },\n    { freq: 220, at: 0.09, dur: 0.14, gain: 0.045, type: 'sawtooth' },\n  ]);\n  haptic([20, 40, 20]);\n}\n", 'utf8');
console.log('[OK] created src/utils/sfx.ts'); ok++;


/* ---- fix12.cjs ---- */

// ===== POLISH-01: prime SFX on the same gesture that primes the ringtone =====
patch("src/context/CallContext.tsx",
`import { primeRingtone } from '../utils/ringtone';`,
`import { primeRingtone } from '../utils/ringtone';
import { primeSfx } from '../utils/sfx';`,
"POLISH-01 import primeSfx");

patch("src/context/CallContext.tsx",
`    const prime = () => primeRingtone();`,
`    const prime = () => { primeRingtone(); primeSfx(); };`,
"POLISH-01 prime sfx on first gesture");

// ===== POLISH-02: honour the existing sound preference =====
patch("src/context/AuthContext.tsx",
`import { invalidateRosterCache } from '../firebase/notifications';`,
`import { invalidateRosterCache } from '../firebase/notifications';
import { setSfxEnabled } from '../utils/sfx';`,
"POLISH-02 import setSfxEnabled");

// ===== POLISH-03: sound + haptics on class chat send =====
patch("src/pages/ChatPage.tsx",
`import { useSavedItems } from '../hooks/useSavedItems';`,
`import { sfxSend, sfxPop, sfxSelect, sfxError } from '../utils/sfx';
import { useSavedItems } from '../hooks/useSavedItems';`,
"POLISH-03 ChatPage import sfx");

// ===== POLISH-04: sound + haptics on DM send =====
patch("src/components/dm/ConversationScreen.tsx",
`import { useSavedItems } from '../../hooks/useSavedItems';`,
`import { sfxSend, sfxPop, sfxSelect, sfxError } from '../../utils/sfx';
import { useSavedItems } from '../../hooks/useSavedItems';`,
"POLISH-04 ConversationScreen import sfx");

// ===== POLISH-05: satisfying tick when a task is completed =====
patch("src/pages/PlannerPage.tsx",
`import { useMyImportant } from '../hooks/useMyImportant';`,
`import { useMyImportant } from '../hooks/useMyImportant';
import { sfxComplete, sfxSelect } from '../utils/sfx';`,
"POLISH-05 PlannerPage import sfx");





/* ---- fix13.cjs ---- */

// ---- class chat: send feedback ----
patch("src/pages/ChatPage.tsx",
`  async function handleSend(text: string) {
    await sendMessage({
      senderId: user!.uid,
      senderName: profile!.displayName,
      senderAvatar: profile!.avatarUrl,
      text,
      replyTo: replyTo ?? null,
    });
    setReplyTo(null);
  }`,
`  async function handleSend(text: string) {
    try {
      await sendMessage({
        senderId: user!.uid,
        senderName: profile!.displayName,
        senderAvatar: profile!.avatarUrl,
        text,
        replyTo: replyTo ?? null,
      });
      sfxSend();
      setReplyTo(null);
    } catch {
      sfxError();
      show("Couldn't send. Check your connection.");
    }
  }`,
"POLISH class chat send sound + failure feedback");

// ---- class chat: reaction + poll vote feedback ----
patch("src/pages/ChatPage.tsx",
`            onVotePoll={(optionId) => voteOnPoll(m.id, optionId, user.uid)}`,
`            onVotePoll={(optionId) => { sfxSelect(); voteOnPoll(m.id, optionId, user.uid); }}`,
"POLISH class chat poll vote sound");

// ---- DM: reaction + poll vote feedback ----
patch("src/components/dm/ConversationScreen.tsx",
`            onVotePoll={(optionId) => voteOnDMPoll(conversation.id, m.id, optionId, user.uid)}`,
`            onVotePoll={(optionId) => { sfxSelect(); voteOnDMPoll(conversation.id, m.id, optionId, user.uid); }}`,
"POLISH DM poll vote sound");

// ---- planner: satisfying completion tick ----
patch("src/pages/PlannerPage.tsx",
`                onToggleDone={(id, next) => user && setCompletion(user.uid, id, next)}`,
`                onToggleDone={(id, next) => {
                  if (!user) return;
                  // Only celebrate on completion, not on un-checking.
                  if (next) sfxComplete();
                  else sfxSelect();
                  setCompletion(user.uid, id, next);
                }}`,
"POLISH planner completion sound");

patch("src/pages/PlannerPage.tsx",
`                onToggleImportant={(id) => user && setImportantForMe(user.uid, id, !importantSet.has(id))}`,
`                onToggleImportant={(id) => {
                  if (!user) return;
                  sfxSelect();
                  setImportantForMe(user.uid, id, !importantSet.has(id));
                }}`,
"POLISH planner pin sound");





/* ---- fix14.cjs ---- */

// ---- DM send: sound + honest failure feedback ----
patch("src/components/dm/ConversationScreen.tsx",
`  async function send(partial: Parameters<typeof sendDM>[0] extends infer T ? Partial<T> : never) {
    await sendDM({
      conversation,
      senderId: user!.uid,
      senderName: profile!.displayName,
      senderAvatar: profile!.avatarUrl,
      kind: 'text',
      replyTo: replyTo ?? null,
      ...partial,
    } as Parameters<typeof sendDM>[0]);
    setReplyTo(null);
  }`,
`  async function send(partial: Parameters<typeof sendDM>[0] extends infer T ? Partial<T> : never) {
    try {
      await sendDM({
        conversation,
        senderId: user!.uid,
        senderName: profile!.displayName,
        senderAvatar: profile!.avatarUrl,
        kind: 'text',
        replyTo: replyTo ?? null,
        ...partial,
      } as Parameters<typeof sendDM>[0]);
      sfxSend();
      setReplyTo(null);
    } catch {
      // BUG-23 family: never silently pretend a message was delivered.
      sfxError();
      show("Couldn't send. Check your connection.");
    }
  }`,
"POLISH DM send sound + failure feedback");

// ---- reaction pop, both surfaces ----
patch("src/components/dm/ConversationScreen.tsx",
`            onReact={(emoji, already) => toggleDMReaction(conversation.id, m.id, emoji, user.uid, already)}`,
`            onReact={(emoji, already) => { if (!already) sfxPop(); toggleDMReaction(conversation.id, m.id, emoji, user.uid, already); }}`,
"POLISH DM reaction pop");

patch("src/pages/ChatPage.tsx",
`            onReact={(emoji, already) => toggleReaction(m.id, emoji, user.uid, already)}`,
`            onReact={(emoji, already) => { if (!already) sfxPop(); toggleReaction(m.id, emoji, user.uid, already); }}`,
"POLISH class chat reaction pop");

// ---- honour the sound preference app-wide ----
patch("src/context/AuthContext.tsx",
`  const [profile, setProfile] = useState<StudentProfile | null>(null);`,
`  const [profile, setProfile] = useState<StudentProfile | null>(null);

  // Keep the UI sound layer in sync with the user's own notification
  // preference, so muting call sound also mutes interface sounds.
  useEffect(() => {
    setSfxEnabled(profile?.notificationSettings?.sound !== false);
  }, [profile?.notificationSettings?.sound]);`,
"POLISH honour sound preference");





// ---- BUG-18: class chat history is now reachable ----

fs.writeFileSync('src/pages/ChatPage.tsx', "import { useEffect, useRef, useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { Users } from 'lucide-react';\nimport TopBar from '../components/layout/TopBar';\nimport MessageBubble from '../components/chat/MessageBubble';\nimport MessageInput from '../components/chat/MessageInput';\nimport ImagePreviewModal from '../components/chat/ImagePreviewModal';\nimport ProfileView from '../components/profile/ProfileView';\nimport { PlannerSkeleton } from '../components/shared/Skeleton';\nimport EmptyState from '../components/shared/EmptyState';\nimport { useMessages } from '../hooks/useMessages';\nimport { useActiveStudentCount } from '../hooks/usePresence';\nimport { useAuth } from '../context/AuthContext';\nimport { useToast } from '../context/ToastContext';\nimport { sendMessage, toggleReaction, deleteOwnMessage, reportMessage, sendPoll, voteOnPoll, closePoll, editMessage, loadOlderMessages } from '../firebase/chat';\nimport { sfxSend, sfxPop, sfxSelect, sfxError } from '../utils/sfx';\nimport { useSavedItems } from '../hooks/useSavedItems';\nimport { saveItem, unsaveItem } from '../firebase/saved';\nimport { uploadChatImage, uploadVoiceClip } from '../firebase/storage';\nimport { pinClassMessage, unpinClassMessage } from '../firebase/pins';\nimport { useClassPins } from '../hooks/useClassPins';\nimport { setClassTyping } from '../firebase/typing';\nimport { useClassTyping } from '../hooks/useClassTyping';\nimport { useTypingThrottle } from '../hooks/useTypingThrottle';\nimport PinnedBar from '../components/chat/PinnedBar';\nimport TypingIndicator from '../components/chat/TypingIndicator';\nimport CreatePollSheet from '../components/chat/CreatePollSheet';\nimport { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';\nimport type { ChatMessage } from '../types';\n\nexport default function ChatPage() {\n  const navigate = useNavigate();\n  const { user, profile } = useAuth();\n  const { show } = useToast();\n  const { messages, loading } = useMessages();\n  const activeCount = useActiveStudentCount();\n  const pinned = useClassPins();\n  const profiles = useLiveProfiles((messages || []).map((m) => m.senderId));\n  const { isSaved } = useSavedItems(user?.uid);\n  const typingNames = useClassTyping(user?.uid);\n  const notifyTyping = useTypingThrottle((isTyping) => {\n    if (user && profile) setClassTyping(user.uid, profile.displayName, isTyping);\n  });\n  const [replyTo, setReplyTo] = useState<ChatMessage['replyTo']>(null);\n  const [previewUrl, setPreviewUrl] = useState<string | null>(null);\n  const [uploading, setUploading] = useState(false);\n  const [viewUid, setViewUid] = useState<string | null>(null);\n  const [pollOpen, setPollOpen] = useState(false);\n\n  // BUG-18: loadOlderMessages() existed but was wired to nothing, so all class\n  // chat history beyond the first page was unreachable in the app.\n  const [older, setOlder] = useState<ChatMessage[]>([]);\n  const [loadingOlder, setLoadingOlder] = useState(false);\n  const [noMoreOlder, setNoMoreOlder] = useState(false);\n\n  async function handleLoadOlder() {\n    const oldestLoaded = older[0] || (messages && messages[0]);\n    if (!oldestLoaded?.createdAt || loadingOlder) return;\n    setLoadingOlder(true);\n    try {\n      const page = await loadOlderMessages(oldestLoaded.createdAt);\n      if (!page.length) setNoMoreOlder(true);\n      else setOlder((prev) => [...page, ...prev]);\n    } catch {\n      show(\"Couldn't load older messages.\");\n    } finally {\n      setLoadingOlder(false);\n    }\n  }\n\n  const messageListRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {\n    if (loading) return;\n\n    const scrollToLatest = () => {\n      const el = messageListRef.current;\n      if (!el) return;\n      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });\n    };\n\n    scrollToLatest();\n    const frame = window.requestAnimationFrame(scrollToLatest);\n    const timer1 = window.setTimeout(scrollToLatest, 120);\n    const timer2 = window.setTimeout(scrollToLatest, 500);\n\n    return () => {\n      window.cancelAnimationFrame(frame);\n      window.clearTimeout(timer1);\n      window.clearTimeout(timer2);\n    };\n  }, [loading, messages?.length]);\n\n  if (!user || !profile) return null;\n\n  async function handleSend(text: string) {\n    try {\n      await sendMessage({\n        senderId: user!.uid,\n        senderName: profile!.displayName,\n        senderAvatar: profile!.avatarUrl,\n        text,\n        replyTo: replyTo ?? null,\n      });\n      sfxSend();\n      setReplyTo(null);\n    } catch {\n      sfxError();\n      show(\"Couldn't send. Check your connection.\");\n    }\n  }\n\n  async function handleSendImage(file: File) {\n    setUploading(true);\n    try {\n      const url = await uploadChatImage(file, user!.uid);\n      await sendMessage({\n        senderId: user!.uid,\n        senderName: profile!.displayName,\n        senderAvatar: profile!.avatarUrl,\n        imageUrl: url,\n        replyTo: replyTo ?? null,\n      });\n      setReplyTo(null);\n    } catch {\n      show(\"Couldn't upload image. Try again.\");\n    } finally {\n      setUploading(false);\n    }\n  }\n\n  async function handleSendVoice(blob: Blob, duration: number) {\n    setUploading(true);\n    try {\n      const url = await uploadVoiceClip(blob, user!.uid);\n      await sendMessage({\n        senderId: user!.uid,\n        senderName: profile!.displayName,\n        senderAvatar: profile!.avatarUrl,\n        audioUrl: url,\n        audioDuration: duration,\n        replyTo: replyTo ?? null,\n      });\n      setReplyTo(null);\n    } catch {\n      show(\"Couldn't send voice message.\");\n    } finally {\n      setUploading(false);\n    }\n  }\n\n  async function handleTogglePin(m: ChatMessage) {\n    const isPinned = pinned.some((p) => p.messageId === m.id);\n    if (isPinned) {\n      await unpinClassMessage(m.id);\n      return;\n    }\n    const preview = m.text || (m.imageUrl ? '\ud83d\udcf7 Photo' : m.audioUrl ? '\ud83c\udfa4 Voice message' : 'Message');\n    const result = await pinClassMessage({\n      messageId: m.id,\n      text: preview,\n      senderName: m.senderName,\n      pinnedBy: user!.uid,\n    });\n    if (result === 'full') show('Unpin something first \u2014 max 20 pinned messages.');\n  }\n\n  async function handleCreatePoll(question: string, options: string[], allowMultiple: boolean) {\n    await sendPoll({\n      senderId: user!.uid,\n      senderName: profile!.displayName,\n      senderAvatar: profile!.avatarUrl,\n      question,\n      options,\n      allowMultiple,\n    });\n  }\n\n  return (\n    <div className=\"flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex-col\">\n      <TopBar\n        title=\"Class Chat\"\n        right={\n          activeCount != null && (\n            <span className=\"flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success\">\n              <Users size={12} /> {activeCount} active\n            </span>\n          )\n        }\n      />\n\n      <PinnedBar pinned={pinned} onUnpin={unpinClassMessage} />\n\n      <div ref={messageListRef} className=\"social-texture flex-1 space-y-3 overflow-y-auto px-3 py-3\">\n        {loading && <PlannerSkeleton />}\n        {!loading && messages?.length === 0 && (\n          <EmptyState emoji=\"\ud83d\udcac\" title=\"No messages yet\" subtitle=\"Say hi to the class!\" />\n        )}\n\n        {!loading && (messages?.length ?? 0) > 0 && !noMoreOlder && (\n          <div className=\"flex justify-center pb-1\">\n            <button\n              onClick={handleLoadOlder}\n              disabled={loadingOlder}\n              className=\"rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-accent disabled:opacity-50\"\n            >\n              {loadingOlder ? 'Loading\u2026' : 'Load earlier messages'}\n            </button>\n          </div>\n        )}\n        {noMoreOlder && (\n          <p className=\"pb-1 text-center text-[11px] text-ink-soft/70\">\n            Start of the conversation\n          </p>\n        )}\n        {[...older, ...(messages || [])].map((m) => (\n          <MessageBubble\n            key={m.id}\n            message={{\n              ...m,\n              senderName: liveName(profiles, m.senderId, m.senderName),\n              senderAvatar: liveAvatar(profiles, m.senderId, m.senderAvatar),\n            }}\n            isMine={m.senderId === user.uid}\n            myUid={user.uid}\n            onReact={(emoji, already) => { if (!already) sfxPop(); toggleReaction(m.id, emoji, user.uid, already); }}\n            onReply={() =>\n              setReplyTo({ id: m.id, senderName: m.senderName, text: m.text })\n            }\n            onDelete={() => deleteOwnMessage(m.id)}\n            onReport={() => {\n              reportMessage(m.id, user.uid);\n              show('Message reported. Thanks for flagging it.');\n            }}\n            onImageClick={setPreviewUrl}\n            onOpenProfile={setViewUid}\n            pinned={pinned.some((p) => p.messageId === m.id)}\n            onTogglePin={() => handleTogglePin(m)}\n            onVotePoll={(optionId) => { sfxSelect(); voteOnPoll(m.id, optionId, user.uid); }}\n            onClosePoll={() => closePoll(m.id)}\n            onEditMessage={(newText) => editMessage(m.id, newText)}\n            saved={isSaved('message', m.id)}\n            onToggleSave={() => isSaved('message', m.id)\n              ? unsaveItem(user.uid, 'message', m.id)\n              : saveItem({ userId: user.uid, type: 'message', refId: m.id, title: m.text || 'Message', imageUrl: m.imageUrl, authorName: m.senderName })}\n          />\n        ))}\n        <div aria-hidden=\"true\" className=\"h-px\" />\n      </div>\n\n      <TypingIndicator names={typingNames} />\n\n      <MessageInput\n        onSend={handleSend}\n        onSendImage={handleSendImage}\n        onSendVoice={handleSendVoice}\n        onTyping={notifyTyping}\n        onCreatePoll={() => setPollOpen(true)}\n        replyTo={replyTo}\n        onCancelReply={() => setReplyTo(null)}\n        uploading={uploading}\n      />\n\n      <CreatePollSheet open={pollOpen} onClose={() => setPollOpen(false)} onCreate={handleCreatePoll} />\n\n      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />\n      <ProfileView uid={viewUid} onClose={() => setViewUid(null)} onImageClick={setPreviewUrl} onStartDM={(id) => { setViewUid(null); navigate(`/messages?open=${id}`); }} />\n    </div>\n  );\n}\n\n\n", 'utf8');
console.log('[OK] BUG-18 ChatPage: Load earlier messages'); ok++;


console.log('\n============================================');
console.log('  ' + ok + ' changes applied, ' + fail + ' FAILED');
console.log('============================================');
if (fail) { console.error('\nDo NOT build. Paste output back.'); process.exit(1); }
console.log('\nNext: npm run build');
