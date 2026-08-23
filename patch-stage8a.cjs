try {

const fs = require("fs");

function patchFile(path, oldStr, newStr, label) {
  let content;
  try { content = fs.readFileSync(path, "utf8"); }
  catch (e) { console.error("[SKIP] " + label + ": could not read " + path + " (" + e.message + ")"); return; }
  if (content.includes(newStr)) { console.log("[OK] " + label + ": already patched, skipping."); return; }
  if (!content.includes(oldStr)) { console.error("[SKIP] " + label + ": expected pattern not found. No changes made."); return; }
  fs.writeFileSync(path, content.replace(oldStr, newStr), "utf8");
  console.log("[OK] " + label + ": patched.");
}

function addFieldAfterPoll(filePath, interfaceName, fieldLine) {
  let content = fs.readFileSync(filePath, "utf8");
  const re = new RegExp("(export interface " + interfaceName + " \\{[\\s\\S]*?poll\\?: Poll;)(\\r?\\n)(\\s*)\\}");
  const m = content.match(re);
  if (!m) { console.error("[FAIL] " + interfaceName + ": could not find 'poll?: Poll;' to anchor off."); return; }
  const fieldName = fieldLine.split(":")[0].trim();
  if (m[1].includes(fieldName)) { console.log("[OK] " + interfaceName + "." + fieldName + " already present, skipping."); return; }
  const nl = m[2], closeIndent = m[3], fieldIndent = closeIndent + "  ";
  content = content.replace(re, m[1] + nl + fieldIndent + fieldLine + nl + closeIndent + "}");
  fs.writeFileSync(filePath, content, "utf8");
  console.log("[OK] " + interfaceName + ": added field '" + fieldLine + "'.");
}

// ==================== types/index.ts ====================

patchFile(
  "src/types/index.ts",
  "export interface CompletionRecord {\n  id: string; // `${userId}_${itemId}`\n  userId: string;\n  itemId: string;\n  done: boolean;\n  updatedAt: Timestamp | null;\n}",
  "export interface CompletionRecord {\n  id: string; // `${userId}_${itemId}`\n  userId: string;\n  itemId: string;\n  done: boolean;\n  important?: boolean; // personal \"pin for me\" marker, independent of the shared task\n  updatedAt: Timestamp | null;\n}",
  "types/index.ts CompletionRecord.important"
);

addFieldAfterPoll("src/types/index.ts", "ChatMessage", "edited?: boolean;");
addFieldAfterPoll("src/types/index.ts", "DMMessage", "edited?: boolean;");

(function () {
  const path = "src/types/index.ts";
  let content = fs.readFileSync(path, "utf8");
  if (content.includes("export interface SavedItem {")) {
    console.log("[OK] SavedItem type already present, skipping.");
    return;
  }
  content += "\n" +
    "export type SavedItemType = 'message' | 'dmMessage' | 'post' | 'reel' | 'study';\n\n" +
    "export interface SavedItem {\n" +
    "  id: string;\n" +
    "  userId: string;\n" +
    "  type: SavedItemType;\n" +
    "  refId: string;\n" +
    "  conversationId?: string;\n" +
    "  title: string;\n" +
    "  imageUrl?: string;\n" +
    "  authorName?: string;\n" +
    "  createdAt: Timestamp | null;\n" +
    "}\n";
  fs.writeFileSync(path, content, "utf8");
  console.log("[OK] types/index.ts: added SavedItem type.");
})();

// ==================== src/firebase/saved.ts (new) ====================

fs.writeFileSync("src/firebase/saved.ts",
  "import {\n" +
  "  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where,\n" +
  "} from 'firebase/firestore';\n" +
  "import { db } from './config';\n" +
  "import type { SavedItem, SavedItemType } from '../types';\n\n" +
  "const savedCol = collection(db, 'saved');\n\n" +
  "function stripUndefined(obj) {\n" +
  "  const clean = { ...obj };\n" +
  "  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);\n" +
  "  return clean;\n" +
  "}\n\n" +
  "function savedId(uid, type, refId) {\n" +
  "  return uid + '_' + type + '_' + refId;\n" +
  "}\n\n" +
  "export interface NewSavedItem {\n" +
  "  userId: string;\n" +
  "  type: SavedItemType;\n" +
  "  refId: string;\n" +
  "  conversationId?: string;\n" +
  "  title: string;\n" +
  "  imageUrl?: string;\n" +
  "  authorName?: string;\n" +
  "}\n\n" +
  "export async function saveItem(item: NewSavedItem) {\n" +
  "  const id = savedId(item.userId, item.type, item.refId);\n" +
  "  await setDoc(doc(savedCol, id), stripUndefined({ ...item, createdAt: serverTimestamp() }));\n" +
  "}\n\n" +
  "export async function unsaveItem(userId: string, type: SavedItemType, refId: string) {\n" +
  "  await deleteDoc(doc(savedCol, savedId(userId, type, refId)));\n" +
  "}\n\n" +
  "export function watchMySaved(uid: string, cb: (items: SavedItem[]) => void) {\n" +
  "  const q = query(savedCol, where('userId', '==', uid));\n" +
  "  return onSnapshot(q, (snap) => {\n" +
  "    const list = snap.docs\n" +
  "      .map((d) => ({ id: d.id, ...d.data() }) as SavedItem)\n" +
  "      .sort((a, b) => ((b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : 0) - ((a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : 0));\n" +
  "    cb(list);\n" +
  "  });\n" +
  "}\n",
  "utf8"
);
console.log("[OK] created src/firebase/saved.ts");

// ==================== src/hooks/useSavedItems.ts (new) ====================

fs.writeFileSync("src/hooks/useSavedItems.ts",
  "import { useEffect, useState } from 'react';\n" +
  "import { watchMySaved } from '../firebase/saved';\n" +
  "import type { SavedItem, SavedItemType } from '../types';\n\n" +
  "export function useSavedItems(uid: string | undefined) {\n" +
  "  const [items, setItems] = useState<SavedItem[]>([]);\n" +
  "  useEffect(() => {\n" +
  "    if (!uid) { setItems([]); return; }\n" +
  "    return watchMySaved(uid, setItems);\n" +
  "  }, [uid]);\n\n" +
  "  function isSaved(type: SavedItemType, refId: string) {\n" +
  "    return items.some((i) => i.type === type && i.refId === refId);\n" +
  "  }\n\n" +
  "  return { items, isSaved };\n" +
  "}\n",
  "utf8"
);
console.log("[OK] created src/hooks/useSavedItems.ts");

// ==================== src/pages/SavedPage.tsx (new) ====================

fs.writeFileSync("src/pages/SavedPage.tsx",
  "import { useState } from 'react';\n" +
  "import { useNavigate } from 'react-router-dom';\n" +
  "import { ArrowLeft, Bookmark, Trash2 } from 'lucide-react';\n" +
  "import EmptyState from '../components/shared/EmptyState';\n" +
  "import ImagePreviewModal from '../components/chat/ImagePreviewModal';\n" +
  "import { useAuth } from '../context/AuthContext';\n" +
  "import { useSavedItems } from '../hooks/useSavedItems';\n" +
  "import { unsaveItem } from '../firebase/saved';\n" +
  "import type { SavedItem } from '../types';\n\n" +
  "const TYPE_LABEL: Record<string, string> = {\n" +
  "  message: 'Class Chat',\n" +
  "  dmMessage: 'Message',\n" +
  "  post: 'Post',\n" +
  "  reel: 'Reel',\n" +
  "  study: 'Study Help',\n" +
  "};\n\n" +
  "export default function SavedPage() {\n" +
  "  const navigate = useNavigate();\n" +
  "  const { user } = useAuth();\n" +
  "  const { items } = useSavedItems(user?.uid);\n" +
  "  const [previewUrl, setPreviewUrl] = useState<string | null>(null);\n\n" +
  "  function open(item: SavedItem) {\n" +
  "    if ((item.type === 'post' || item.type === 'reel' || item.type === 'study') && item.imageUrl) {\n" +
  "      setPreviewUrl(item.imageUrl);\n" +
  "    } else if (item.type === 'dmMessage' && item.conversationId) {\n" +
  "      navigate('/messages?open=' + item.conversationId);\n" +
  "    } else if (item.type === 'message') {\n" +
  "      navigate('/chat');\n" +
  "    }\n" +
  "  }\n\n" +
  "  return (\n" +
  "    <div className=\"pb-24\">\n" +
  "      <header className=\"sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-paper/95 px-2 py-3 pt-[env(safe-area-inset-top)] backdrop-blur\">\n" +
  "        <button onClick={() => navigate(-1)} aria-label=\"Back\" className=\"rounded-full p-2 text-ink-soft hover:bg-surface-alt\">\n" +
  "          <ArrowLeft size={20} />\n" +
  "        </button>\n" +
  "        <p className=\"font-display text-lg font-semibold text-ink\">Saved</p>\n" +
  "      </header>\n\n" +
  "      {items.length === 0 ? (\n" +
  "        <div className=\"px-4 pt-8\">\n" +
  "          <EmptyState emoji=\"\ud83d\udd16\" title=\"Nothing saved yet\" subtitle=\"Tap the bookmark icon on a post, reel, message, or study material to save it here.\" />\n" +
  "        </div>\n" +
  "      ) : (\n" +
  "        <div className=\"divide-y divide-line px-2\">\n" +
  "          {items.map((item) => (\n" +
  "            <div key={item.id} className=\"flex items-center gap-3 px-2 py-3\">\n" +
  "              <button onClick={() => open(item)} className=\"flex flex-1 items-center gap-3 text-left\">\n" +
  "                {item.imageUrl ? (\n" +
  "                  <img src={item.imageUrl} alt=\"\" className=\"h-12 w-12 shrink-0 rounded-lg object-cover\" />\n" +
  "                ) : (\n" +
  "                  <div className=\"flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent\">\n" +
  "                    <Bookmark size={18} />\n" +
  "                  </div>\n" +
  "                )}\n" +
  "                <div className=\"min-w-0 flex-1\">\n" +
  "                  <p className=\"text-[11px] font-semibold uppercase tracking-wide text-ink-soft\">{TYPE_LABEL[item.type]}</p>\n" +
  "                  <p className=\"truncate text-sm text-ink\">{item.title}</p>\n" +
  "                  {item.authorName && <p className=\"truncate text-xs text-ink-soft\">{item.authorName}</p>}\n" +
  "                </div>\n" +
  "              </button>\n" +
  "              <button\n" +
  "                onClick={() => unsaveItem(item.userId, item.type, item.refId)}\n" +
  "                aria-label=\"Remove from saved\"\n" +
  "                className=\"shrink-0 rounded-full p-1.5 text-ink-soft hover:text-coral\"\n" +
  "              >\n" +
  "                <Trash2 size={16} />\n" +
  "              </button>\n" +
  "            </div>\n" +
  "          ))}\n" +
  "        </div>\n" +
  "      )}\n\n" +
  "      <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />\n" +
  "    </div>\n" +
  "  );\n" +
  "}\n",
  "utf8"
);
console.log("[OK] created src/pages/SavedPage.tsx");

// ==================== planner.ts: setImportantForMe ====================

patchFile(
  "src/firebase/planner.ts",
  "export async function setCompletion(userId: string, itemId: string, done: boolean) {\n  // Deterministic doc id (userId_itemId) means this always upserts the same doc\n  // instead of creating duplicates every time a student toggles a checkbox.\n  const id = `${userId}_${itemId}`;\n  await setDoc(\n    doc(completionCol, id),\n    { userId, itemId, done, updatedAt: serverTimestamp() },\n    { merge: true }\n  );\n}",
  "export async function setCompletion(userId: string, itemId: string, done: boolean) {\n  // Deterministic doc id (userId_itemId) means this always upserts the same doc\n  // instead of creating duplicates every time a student toggles a checkbox.\n  const id = `${userId}_${itemId}`;\n  await setDoc(\n    doc(completionCol, id),\n    { userId, itemId, done, updatedAt: serverTimestamp() },\n    { merge: true }\n  );\n}\n\n/** Personal \"pin for me\" marker -- merges onto the same per-user completion\n * doc without touching `done`, so it never changes the shared task. */\nexport async function setImportantForMe(userId: string, itemId: string, important: boolean) {\n  const id = `${userId}_${itemId}`;\n  await setDoc(\n    doc(completionCol, id),\n    { userId, itemId, important, updatedAt: serverTimestamp() },\n    { merge: true }\n  );\n}",
  "planner.ts setImportantForMe"
);

// ==================== hooks/useMyImportant.ts (new) ====================

fs.writeFileSync("src/hooks/useMyImportant.ts",
  "import { useEffect, useState } from 'react';\n" +
  "import { collection, onSnapshot, query, where } from 'firebase/firestore';\n" +
  "import { db } from '../firebase/config';\n" +
  "import type { CompletionRecord } from '../types';\n\n" +
  "/** Separate small listener on the same completionStatus collection, scoped\n" +
  " * to just the `important` field -- kept independent of watchMyCompletions\n" +
  " * so that hook's existing return shape (used across Planner) is untouched. */\n" +
  "export function useMyImportant(userId: string | undefined) {\n" +
  "  const [importantSet, setImportantSet] = useState<Set<string>>(new Set());\n\n" +
  "  useEffect(() => {\n" +
  "    if (!userId) { setImportantSet(new Set()); return; }\n" +
  "    const q = query(collection(db, 'completionStatus'), where('userId', '==', userId));\n" +
  "    return onSnapshot(q, (snap) => {\n" +
  "      const set = new Set<string>();\n" +
  "      snap.docs.forEach((d) => {\n" +
  "        const data = d.data() as CompletionRecord;\n" +
  "        if (data.important) set.add(data.itemId);\n" +
  "      });\n" +
  "      setImportantSet(set);\n" +
  "    });\n" +
  "  }, [userId]);\n\n" +
  "  return importantSet;\n" +
  "}\n",
  "utf8"
);
console.log("[OK] created src/hooks/useMyImportant.ts");

// ==================== chat.ts / dm.ts: editMessage ====================

patchFile(
  "src/firebase/chat.ts",
  "export async function reportMessage(messageId: string, reporterId: string) {",
  "export async function editMessage(messageId: string, newText: string) {\n  await updateDoc(doc(messagesCol, messageId), { text: newText.trim().slice(0, 500), edited: true });\n}\n\nexport async function reportMessage(messageId: string, reporterId: string) {",
  "chat.ts editMessage"
);

patchFile(
  "src/firebase/dm.ts",
  "export async function deleteDMMessage(conversationId: string, messageId: string) {",
  "export async function editDMMessage(conversationId: string, messageId: string, newText: string) {\n  await updateDoc(doc(msgCol(conversationId), messageId), { text: newText.trim().slice(0, 2000), edited: true });\n}\n\nexport async function deleteDMMessage(conversationId: string, messageId: string) {",
  "dm.ts editDMMessage"
);

// ==================== MessageBubble.tsx (full rewrite -- fresh content, edit + save UI) ====================

fs.writeFileSync("src/components/chat/MessageBubble.tsx",
  "import { useState } from 'react';\n" +
  "import { SmilePlus, Reply, Trash2, Flag, Pin, PinOff, Pencil, Bookmark } from 'lucide-react';\n" +
  "import type { ChatMessage } from '../../types';\n" +
  "import Avatar from '../shared/Avatar';\n" +
  "import EmojiPicker from './EmojiPicker';\n" +
  "import ReactionRow from './ReactionRow';\n" +
  "import VoicePlayer from '../dm/VoicePlayer';\n" +
  "import PollCard from './PollCard';\n" +
  "import { relativeTime } from '../../utils/date';\n\n" +
  "interface MessageBubbleProps {\n" +
  "  message: ChatMessage;\n" +
  "  isMine: boolean;\n" +
  "  myUid: string;\n" +
  "  onReact: (emoji: string, alreadyReacted: boolean) => void;\n" +
  "  onReply: () => void;\n" +
  "  onDelete: () => void;\n" +
  "  onReport: () => void;\n" +
  "  onImageClick: (url: string) => void;\n" +
  "  onOpenProfile: (uid: string) => void;\n" +
  "  pinned: boolean;\n" +
  "  onTogglePin: () => void;\n" +
  "  onVotePoll: (optionId: string) => void;\n" +
  "  onClosePoll: () => void;\n" +
  "  onEditMessage: (newText: string) => void;\n" +
  "  saved: boolean;\n" +
  "  onToggleSave: () => void;\n" +
  "}\n\n" +
  "export default function MessageBubble({\n" +
  "  message, isMine, myUid, onReact, onReply, onDelete, onReport, onImageClick, onOpenProfile,\n" +
  "  pinned, onTogglePin, onVotePoll, onClosePoll, onEditMessage, saved, onToggleSave,\n" +
  "}: MessageBubbleProps) {\n" +
  "  const [pickerOpen, setPickerOpen] = useState(false);\n" +
  "  const [menuOpen, setMenuOpen] = useState(false);\n" +
  "  const [editing, setEditing] = useState(false);\n" +
  "  const [editText, setEditText] = useState('');\n" +
  "  const createdDate = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();\n" +
  "  const canEdit = isMine && !!message.text && !message.imageUrl && !message.audioUrl && !message.poll;\n\n" +
  "  if (message.deleted) {\n" +
  "    return (\n" +
  "      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>\n" +
  "        <p className=\"italic text-xs text-ink-soft px-3 py-1\">Message deleted</p>\n" +
  "      </div>\n" +
  "    );\n" +
  "  }\n\n" +
  "  return (\n" +
  "    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>\n" +
  "      {!isMine && (\n" +
  "        <button onClick={() => onOpenProfile(message.senderId)} aria-label={`View ${message.senderName}'s profile`}>\n" +
  "          <Avatar name={message.senderName} src={message.senderAvatar} size=\"sm\" />\n" +
  "        </button>\n" +
  "      )}\n" +
  "      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>\n" +
  "        {!isMine && (\n" +
  "          <button onClick={() => onOpenProfile(message.senderId)} className=\"mb-0.5 px-1 text-xs font-semibold text-ink-soft\">\n" +
  "            {message.senderName}\n" +
  "          </button>\n" +
  "        )}\n\n" +
  "        {message.replyTo && (\n" +
  "          <div className=\"mb-1 max-w-full truncate rounded-lg border-l-2 border-accent bg-surface-alt px-2 py-1 text-xs text-ink-soft\">\n" +
  "            <span className=\"font-semibold\">{message.replyTo.senderName}: </span>\n" +
  "            {message.replyTo.text || 'Photo'}\n" +
  "          </div>\n" +
  "        )}\n\n" +
  "        <div className={`relative rounded-2xl px-3.5 py-2.5 text-sm ${isMine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-surface text-ink'}`}>\n" +
  "          {message.imageUrl && (\n" +
  "            <img src={message.imageUrl} alt=\"Shared\" onClick={() => onImageClick(message.imageUrl!)} className=\"mb-1 max-h-56 w-full cursor-pointer rounded-xl object-cover\" />\n" +
  "          )}\n" +
  "          {message.audioUrl && <VoicePlayer url={message.audioUrl} duration={message.audioDuration} mine={isMine} />}\n" +
  "          {message.poll && (\n" +
  "            <PollCard poll={message.poll} myUid={myUid} mine={isMine} onVote={onVotePoll} onClose={message.poll.createdBy === myUid ? onClosePoll : undefined} />\n" +
  "          )}\n" +
  "          {editing ? (\n" +
  "            <div className=\"space-y-1.5\">\n" +
  "              <textarea\n" +
  "                value={editText}\n" +
  "                onChange={(e) => setEditText(e.target.value.slice(0, 500))}\n" +
  "                rows={2}\n" +
  "                autoFocus\n" +
  "                className={`w-full resize-none rounded-lg border px-2 py-1.5 text-sm outline-none ${isMine ? 'border-white/30 bg-white/10 text-white' : 'border-line bg-paper text-ink'}`}\n" +
  "              />\n" +
  "              <div className=\"flex justify-end gap-2\">\n" +
  "                <button onClick={() => setEditing(false)} className={`rounded-full px-3 py-1 text-xs font-medium ${isMine ? 'text-white/80' : 'text-ink-soft'}`}>Cancel</button>\n" +
  "                <button\n" +
  "                  onClick={() => { if (editText.trim()) { onEditMessage(editText.trim()); setEditing(false); } }}\n" +
  "                  disabled={!editText.trim()}\n" +
  "                  className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${isMine ? 'bg-white text-accent' : 'bg-accent text-white'}`}\n" +
  "                >\n" +
  "                  Save\n" +
  "                </button>\n" +
  "              </div>\n" +
  "            </div>\n" +
  "          ) : (\n" +
  "            message.text && <p className=\"whitespace-pre-wrap break-words\">{message.text}</p>\n" +
  "          )}\n" +
  "        </div>\n\n" +
  "        <div className=\"mt-0.5 flex items-center gap-2 px-1\">\n" +
  "          <span className=\"text-[11px] text-ink-soft\">{relativeTime(createdDate)}{message.edited ? ' \u00b7 edited' : ''}</span>\n" +
  "          <button onClick={() => setPickerOpen((o) => !o)} className=\"text-ink-soft hover:text-accent\"><SmilePlus size={14} /></button>\n" +
  "          <button onClick={onReply} className=\"text-ink-soft hover:text-accent\"><Reply size={14} /></button>\n" +
  "          <button onClick={() => setMenuOpen((o) => !o)} className=\"text-ink-soft hover:text-accent\">\u2022\u2022\u2022</button>\n" +
  "        </div>\n\n" +
  "        {pickerOpen && (\n" +
  "          <div className=\"mt-1\">\n" +
  "            <EmojiPicker onPick={(emoji) => { const already = (message.reactions?.[emoji] || []).includes(myUid); onReact(emoji, already); setPickerOpen(false); }} />\n" +
  "          </div>\n" +
  "        )}\n\n" +
  "        {menuOpen && (\n" +
  "          <div className=\"mt-1 overflow-hidden rounded-xl border border-line bg-surface text-xs shadow-lg\">\n" +
  "            <button onClick={() => { setMenuOpen(false); onTogglePin(); }} className=\"flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt\">\n" +
  "              {pinned ? <PinOff size={13} /> : <Pin size={13} />} {pinned ? 'Unpin' : 'Pin'}\n" +
  "            </button>\n" +
  "            <button onClick={() => { setMenuOpen(false); onToggleSave(); }} className=\"flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt\">\n" +
  "              <Bookmark size={13} className={saved ? 'fill-current' : ''} /> {saved ? 'Unsave' : 'Save'}\n" +
  "            </button>\n" +
  "            {canEdit && (\n" +
  "              <button onClick={() => { setMenuOpen(false); setEditText(message.text || ''); setEditing(true); }} className=\"flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt\">\n" +
  "                <Pencil size={13} /> Edit\n" +
  "              </button>\n" +
  "            )}\n" +
  "            {isMine ? (\n" +
  "              <button onClick={() => { setMenuOpen(false); onDelete(); }} className=\"flex w-full items-center gap-1.5 px-3 py-2 text-coral hover:bg-coral-soft\">\n" +
  "                <Trash2 size={13} /> Delete\n" +
  "              </button>\n" +
  "            ) : (\n" +
  "              <button onClick={() => { setMenuOpen(false); onReport(); }} className=\"flex w-full items-center gap-1.5 px-3 py-2 text-ink-soft hover:bg-surface-alt\">\n" +
  "                <Flag size={13} /> Report\n" +
  "              </button>\n" +
  "            )}\n" +
  "          </div>\n" +
  "        )}\n\n" +
  "        <ReactionRow reactions={message.reactions} myUid={myUid} onToggle={onReact} />\n" +
  "      </div>\n" +
  "    </div>\n" +
  "  );\n" +
  "}\n",
  "utf8"
);
console.log("[OK] MessageBubble.tsx rewritten with edit + save.");

// ==================== DMBubble.tsx (full rewrite) ====================

fs.writeFileSync("src/components/dm/DMBubble.tsx",
  "import { useState } from 'react';\n" +
  "import { SmilePlus, Reply, Trash2, Pin, Pencil, Bookmark } from 'lucide-react';\n" +
  "import Avatar from '../shared/Avatar';\n" +
  "import EmojiPicker from '../chat/EmojiPicker';\n" +
  "import ReactionRow from '../chat/ReactionRow';\n" +
  "import VoicePlayer from './VoicePlayer';\n" +
  "import SharedPreview from './SharedPreview';\n" +
  "import PollCard from '../chat/PollCard';\n" +
  "import { relativeTime } from '../../utils/date';\n" +
  "import type { DMMessage } from '../../types';\n\n" +
  "interface DMBubbleProps {\n" +
  "  message: DMMessage;\n" +
  "  isMine: boolean;\n" +
  "  myUid: string;\n" +
  "  isGroup: boolean;\n" +
  "  onReact: (emoji: string, already: boolean) => void;\n" +
  "  onReply: () => void;\n" +
  "  onDelete: () => void;\n" +
  "  onImageClick: (url: string) => void;\n" +
  "  onOpenShared: (shared: NonNullable<DMMessage['shared']>) => void;\n" +
  "  onOpenProfile: (uid: string) => void;\n" +
  "  pinned: boolean;\n" +
  "  onTogglePin: () => void;\n" +
  "  receiptLabel?: string;\n" +
  "  onVotePoll: (optionId: string) => void;\n" +
  "  onClosePoll: () => void;\n" +
  "  onEditMessage: (newText: string) => void;\n" +
  "  saved: boolean;\n" +
  "  onToggleSave: () => void;\n" +
  "}\n\n" +
  "export default function DMBubble({\n" +
  "  message, isMine, myUid, isGroup, onReact, onReply, onDelete, onImageClick, onOpenShared, onOpenProfile,\n" +
  "  pinned, onTogglePin, receiptLabel, onVotePoll, onClosePoll, onEditMessage, saved, onToggleSave,\n" +
  "}: DMBubbleProps) {\n" +
  "  const [picker, setPicker] = useState(false);\n" +
  "  const [editing, setEditing] = useState(false);\n" +
  "  const [editText, setEditText] = useState('');\n" +
  "  const created = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();\n" +
  "  const canEdit = isMine && message.kind === 'text';\n\n" +
  "  if (message.deleted) {\n" +
  "    return (\n" +
  "      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>\n" +
  "        <p className=\"px-3 py-1 text-xs italic text-ink-soft\">Message deleted</p>\n" +
  "      </div>\n" +
  "    );\n" +
  "  }\n\n" +
  "  return (\n" +
  "    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>\n" +
  "      {!isMine && isGroup && (\n" +
  "        <button onClick={() => onOpenProfile(message.senderId)}>\n" +
  "          <Avatar name={message.senderName} src={message.senderAvatar} size=\"sm\" />\n" +
  "        </button>\n" +
  "      )}\n" +
  "      <div className={`flex max-w-[78%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>\n" +
  "        {!isMine && isGroup && (\n" +
  "          <button onClick={() => onOpenProfile(message.senderId)} className=\"mb-0.5 px-1 text-xs font-semibold text-ink-soft\">\n" +
  "            {message.senderName}\n" +
  "          </button>\n" +
  "        )}\n\n" +
  "        {message.replyTo && (\n" +
  "          <div className=\"mb-1 max-w-full truncate rounded-lg border-l-2 border-accent bg-surface-alt px-2 py-1 text-xs text-ink-soft\">\n" +
  "            <span className=\"font-semibold\">{message.replyTo.senderName}: </span>\n" +
  "            {message.replyTo.preview}\n" +
  "          </div>\n" +
  "        )}\n\n" +
  "        <div className={`relative rounded-2xl px-3 py-2 text-sm ${isMine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-surface text-ink'} ${message.kind === 'voice' ? 'min-w-[180px]' : ''}`}>\n" +
  "          {message.kind === 'image' && message.imageUrl && (\n" +
  "            <img src={message.imageUrl} alt=\"Shared\" onClick={() => onImageClick(message.imageUrl!)} className=\"mb-1 max-h-60 w-full cursor-pointer rounded-xl object-cover\" />\n" +
  "          )}\n" +
  "          {message.kind === 'voice' && message.audioUrl && <VoicePlayer url={message.audioUrl} duration={message.audioDuration} mine={isMine} />}\n" +
  "          {(message.kind === 'sharedPost' || message.kind === 'sharedReel' || message.kind === 'sharedStory') && message.shared && (\n" +
  "            <SharedPreview shared={message.shared} mine={isMine} onOpen={() => onOpenShared(message.shared!)} />\n" +
  "          )}\n" +
  "          {message.kind === 'poll' && message.poll && (\n" +
  "            <PollCard poll={message.poll} myUid={myUid} mine={isMine} onVote={onVotePoll} onClose={message.poll.createdBy === myUid ? onClosePoll : undefined} />\n" +
  "          )}\n" +
  "          {editing ? (\n" +
  "            <div className=\"space-y-1.5\">\n" +
  "              <textarea\n" +
  "                value={editText}\n" +
  "                onChange={(e) => setEditText(e.target.value.slice(0, 2000))}\n" +
  "                rows={2}\n" +
  "                autoFocus\n" +
  "                className={`w-full resize-none rounded-lg border px-2 py-1.5 text-sm outline-none ${isMine ? 'border-white/30 bg-white/10 text-white' : 'border-line bg-paper text-ink'}`}\n" +
  "              />\n" +
  "              <div className=\"flex justify-end gap-2\">\n" +
  "                <button onClick={() => setEditing(false)} className={`rounded-full px-3 py-1 text-xs font-medium ${isMine ? 'text-white/80' : 'text-ink-soft'}`}>Cancel</button>\n" +
  "                <button\n" +
  "                  onClick={() => { if (editText.trim()) { onEditMessage(editText.trim()); setEditing(false); } }}\n" +
  "                  disabled={!editText.trim()}\n" +
  "                  className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${isMine ? 'bg-white text-accent' : 'bg-accent text-white'}`}\n" +
  "                >\n" +
  "                  Save\n" +
  "                </button>\n" +
  "              </div>\n" +
  "            </div>\n" +
  "          ) : (\n" +
  "            message.text && <p className=\"whitespace-pre-wrap break-words\">{message.text}</p>\n" +
  "          )}\n" +
  "        </div>\n\n" +
  "        <div className=\"mt-0.5 flex items-center gap-2 px-1\">\n" +
  "          <span className=\"text-[11px] text-ink-soft\">{relativeTime(created)}{message.edited ? ' \u00b7 edited' : ''}</span>\n" +
  "          {receiptLabel && <span className=\"text-[11px] font-medium text-accent\">{receiptLabel}</span>}\n" +
  "          <button onClick={() => setPicker((o) => !o)} className=\"text-ink-soft hover:text-accent\"><SmilePlus size={14} /></button>\n" +
  "          <button onClick={onReply} className=\"text-ink-soft hover:text-accent\"><Reply size={14} /></button>\n" +
  "          <button onClick={onTogglePin} aria-label={pinned ? 'Unpin' : 'Pin'} className={pinned ? 'text-accent' : 'text-ink-soft hover:text-accent'}>\n" +
  "            <Pin size={13} className={pinned ? 'fill-accent' : ''} />\n" +
  "          </button>\n" +
  "          <button onClick={onToggleSave} aria-label={saved ? 'Unsave' : 'Save'} className={saved ? 'text-accent' : 'text-ink-soft hover:text-accent'}>\n" +
  "            <Bookmark size={13} className={saved ? 'fill-current' : ''} />\n" +
  "          </button>\n" +
  "          {canEdit && (\n" +
  "            <button onClick={() => { setEditText(message.text || ''); setEditing(true); }} className=\"text-ink-soft hover:text-accent\">\n" +
  "              <Pencil size={13} />\n" +
  "            </button>\n" +
  "          )}\n" +
  "          {isMine && (\n" +
  "            <button onClick={onDelete} className=\"text-ink-soft hover:text-coral\"><Trash2 size={13} /></button>\n" +
  "          )}\n" +
  "        </div>\n\n" +
  "        {picker && (\n" +
  "          <div className=\"mt-1\">\n" +
  "            <EmojiPicker onPick={(emoji) => { const already = (message.reactions?.[emoji] || []).includes(myUid); onReact(emoji, already); setPicker(false); }} />\n" +
  "          </div>\n" +
  "        )}\n\n" +
  "        <ReactionRow reactions={message.reactions} myUid={myUid} onToggle={onReact} />\n" +
  "      </div>\n" +
  "    </div>\n" +
  "  );\n" +
  "}\n",
  "utf8"
);
console.log("[OK] DMBubble.tsx rewritten with edit + save.");

// ==================== TaskCard.tsx (full rewrite -- important star) ====================

fs.writeFileSync("src/components/planner/TaskCard.tsx",
  "import { useState } from 'react';\n" +
  "import { Check, MoreVertical, Pencil, Trash2, Star } from 'lucide-react';\n" +
  "import type { PlannerItem } from '../../types';\n" +
  "import SubjectPill from '../shared/SubjectPill';\n" +
  "import { daysLeftLabel } from '../../utils/date';\n\n" +
  "interface TaskCardProps {\n" +
  "  item: PlannerItem;\n" +
  "  done?: boolean;\n" +
  "  onToggleDone?: () => void;\n" +
  "  onEdit: () => void;\n" +
  "  onDelete: () => void;\n" +
  "  showCheckbox: boolean;\n" +
  "  important?: boolean;\n" +
  "  onToggleImportant?: () => void;\n" +
  "}\n\n" +
  "export default function TaskCard({ item, done, onToggleDone, onEdit, onDelete, showCheckbox, important, onToggleImportant }: TaskCardProps) {\n" +
  "  const [menuOpen, setMenuOpen] = useState(false);\n\n" +
  "  return (\n" +
  "    <div className={`group relative rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition-opacity ${done ? 'opacity-60' : ''}`}>\n" +
  "      <div className=\"flex items-start gap-3\">\n" +
  "        {showCheckbox && (\n" +
  "          <button\n" +
  "            onClick={onToggleDone}\n" +
  "            aria-label={done ? 'Mark as not done' : 'Mark as done'}\n" +
  "            aria-pressed={done}\n" +
  "            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-success bg-success text-white animate-pop' : 'border-line text-transparent'}`}\n" +
  "          >\n" +
  "            <Check size={14} strokeWidth={3} />\n" +
  "          </button>\n" +
  "        )}\n\n" +
  "        <div className=\"min-w-0 flex-1\">\n" +
  "          <div className=\"mb-1 flex flex-wrap items-center gap-1.5\">\n" +
  "            <SubjectPill subjectId={item.subject} size=\"sm\" />\n" +
  "            {important && <Star size={14} className=\"fill-amber-400 text-amber-400\" aria-label=\"Pinned for you\" />}\n" +
  "            {item.category === 'test' && item.dueDate && (\n" +
  "              <span className=\"rounded-full bg-coral-soft px-2 py-0.5 text-xs font-semibold text-coral\">{daysLeftLabel(item.dueDate)}</span>\n" +
  "            )}\n" +
  "            {item.category === 'project' && item.dueDate && (\n" +
  "              <span className=\"rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent\">{daysLeftLabel(item.dueDate)}</span>\n" +
  "            )}\n" +
  "          </div>\n" +
  "          <p className={`font-medium text-ink ${done ? 'line-through' : ''}`}>{item.title}</p>\n" +
  "          {item.description && <p className=\"mt-0.5 text-sm text-ink-soft\">{item.description}</p>}\n" +
  "          {item.portion && <p className=\"mt-0.5 text-xs text-ink-soft\">Portion: {item.portion}</p>}\n" +
  "          {item.note && <p className=\"mt-1 text-xs italic text-ink-soft\">{item.note}</p>}\n" +
  "          {(item.updatedByName || item.createdByName) && (\n" +
  "            <p className=\"mt-1.5 text-[11px] text-ink-soft/70\">{item.updatedByName ? `Updated by ${item.updatedByName}` : `Added by ${item.createdByName}`}</p>\n" +
  "          )}\n" +
  "        </div>\n\n" +
  "        <div className=\"relative shrink-0\">\n" +
  "          <button onClick={() => setMenuOpen((o) => !o)} aria-label=\"More options\" className=\"rounded-full p-1.5 text-ink-soft hover:bg-surface-alt\">\n" +
  "            <MoreVertical size={18} />\n" +
  "          </button>\n" +
  "          {menuOpen && (\n" +
  "            <>\n" +
  "              <div className=\"fixed inset-0 z-10\" onClick={() => setMenuOpen(false)} />\n" +
  "              <div className=\"absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-line bg-surface shadow-lg\">\n" +
  "                {onToggleImportant && (\n" +
  "                  <button onClick={() => { setMenuOpen(false); onToggleImportant(); }} className=\"flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-alt\">\n" +
  "                    <Star size={15} className={important ? 'fill-amber-400 text-amber-400' : ''} /> {important ? 'Unpin for me' : 'Pin for me'}\n" +
  "                  </button>\n" +
  "                )}\n" +
  "                <button onClick={() => { setMenuOpen(false); onEdit(); }} className=\"flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-alt\">\n" +
  "                  <Pencil size={15} /> Edit\n" +
  "                </button>\n" +
  "                <button onClick={() => { setMenuOpen(false); onDelete(); }} className=\"flex w-full items-center gap-2 px-3 py-2.5 text-sm text-coral hover:bg-coral-soft\">\n" +
  "                  <Trash2 size={15} /> Delete\n" +
  "                </button>\n" +
  "              </div>\n" +
  "            </>\n" +
  "          )}\n" +
  "        </div>\n" +
  "      </div>\n" +
  "    </div>\n" +
  "  );\n" +
  "}\n",
  "utf8"
);
console.log("[OK] TaskCard.tsx rewritten with Pin-for-me star.");

// ==================== CategorySection.tsx (full rewrite -- thread important) ====================

fs.writeFileSync("src/components/planner/CategorySection.tsx",
  "import * as Icons from 'lucide-react';\n" +
  "import type { PlannerItem } from '../../types';\n" +
  "import { CATEGORY_META } from '../../data/categories';\n" +
  "import TaskCard from './TaskCard';\n" +
  "import EmptyState from '../shared/EmptyState';\n\n" +
  "interface CategorySectionProps {\n" +
  "  category: PlannerItem['category'];\n" +
  "  items: PlannerItem[];\n" +
  "  completions: Record<string, boolean>;\n" +
  "  onToggleDone: (itemId: string, next: boolean) => void;\n" +
  "  onEdit: (item: PlannerItem) => void;\n" +
  "  onDelete: (item: PlannerItem) => void;\n" +
  "  emptyLabel?: string;\n" +
  "  importantSet?: Set<string>;\n" +
  "  onToggleImportant?: (itemId: string) => void;\n" +
  "}\n\n" +
  "export default function CategorySection({\n" +
  "  category, items, completions, onToggleDone, onEdit, onDelete, emptyLabel, importantSet, onToggleImportant,\n" +
  "}: CategorySectionProps) {\n" +
  "  const meta = CATEGORY_META[category];\n" +
  "  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[meta.icon] || Icons.BookMarked;\n" +
  "  const showCheckbox = category === 'writing' || category === 'reading' || category === 'bring';\n\n" +
  "  if (items.length === 0 && !emptyLabel) return null;\n\n" +
  "  return (\n" +
  "    <section>\n" +
  "      <div className=\"mb-2 flex items-center gap-2 px-1\">\n" +
  "        <Icon size={17} className=\"text-ink-soft\" />\n" +
  "        <h3 className=\"font-display text-sm font-semibold uppercase tracking-wide text-ink-soft\">{meta.plural}</h3>\n" +
  "      </div>\n" +
  "      {items.length === 0 ? (\n" +
  "        <EmptyState emoji=\"\ud83c\udf89\" title={emptyLabel || 'Nothing here'} />\n" +
  "      ) : (\n" +
  "        <div className=\"space-y-2\">\n" +
  "          {items.map((item) => (\n" +
  "            <TaskCard\n" +
  "              key={item.id}\n" +
  "              item={item}\n" +
  "              done={completions[item.id]}\n" +
  "              onToggleDone={() => onToggleDone(item.id, !completions[item.id])}\n" +
  "              onEdit={() => onEdit(item)}\n" +
  "              onDelete={() => onDelete(item)}\n" +
  "              showCheckbox={showCheckbox}\n" +
  "              important={importantSet ? importantSet.has(item.id) : false}\n" +
  "              onToggleImportant={onToggleImportant ? () => onToggleImportant(item.id) : undefined}\n" +
  "            />\n" +
  "          ))}\n" +
  "        </div>\n" +
  "      )}\n" +
  "    </section>\n" +
  "  );\n" +
  "}\n",
  "utf8"
);
console.log("[OK] CategorySection.tsx rewritten threading importantSet.");

// ==================== PlannerPage.tsx: wire useMyImportant ====================

patchFile(
  "src/pages/PlannerPage.tsx",
  "import { setCompletion, softDeletePlannerItem, restorePlannerItem } from '../firebase/planner';",
  "import { setCompletion, setImportantForMe, softDeletePlannerItem, restorePlannerItem } from '../firebase/planner';\nimport { useMyImportant } from '../hooks/useMyImportant';",
  "PlannerPage.tsx imports"
);

patchFile(
  "src/pages/PlannerPage.tsx",
  "  const { items, completions, loading } = usePlannerDay(activeClass, dateKey, user?.uid);",
  "  const { items, completions, loading } = usePlannerDay(activeClass, dateKey, user?.uid);\n  const importantSet = useMyImportant(user?.uid);",
  "PlannerPage.tsx useMyImportant hook"
);

patchFile(
  "src/pages/PlannerPage.tsx",
  "                onToggleDone={(id, next) => user && setCompletion(user.uid, id, next)}\n                onEdit={openEdit}\n                onDelete={setDeleteTarget}\n              />",
  "                onToggleDone={(id, next) => user && setCompletion(user.uid, id, next)}\n                onEdit={openEdit}\n                onDelete={setDeleteTarget}\n                importantSet={importantSet}\n                onToggleImportant={(id) => user && setImportantForMe(user.uid, id, !importantSet.has(id))}\n              />",
  "PlannerPage.tsx wire importantSet to CategorySection"
);

// ==================== PostCard.tsx (full rewrite -- bookmark) ====================

fs.writeFileSync("src/components/home/PostCard.tsx",
  "import { Heart, Trash2, MessageCircle, Send, Bookmark } from 'lucide-react';\n" +
  "import Avatar from '../shared/Avatar';\n" +
  "import type { Post } from '../../types';\n" +
  "import { toggleLike, deletePost } from '../../firebase/posts';\n" +
  "import { useAuth } from '../../context/AuthContext';\n" +
  "import { relativeTime } from '../../utils/date';\n\n" +
  "export default function PostCard({\n" +
  "  post, onOpenProfile, onImageClick, onOpenComments, onShare, saved, onToggleSave,\n" +
  "}: {\n" +
  "  post: Post;\n" +
  "  onOpenProfile: (uid: string) => void;\n" +
  "  onImageClick: (url: string) => void;\n" +
  "  onOpenComments: (postId: string) => void;\n" +
  "  onShare: (post: Post) => void;\n" +
  "  saved?: boolean;\n" +
  "  onToggleSave?: () => void;\n" +
  "}) {\n" +
  "  const { user } = useAuth();\n" +
  "  const liked = post.likes?.includes(user?.uid || '') ?? false;\n" +
  "  const likeCount = post.likes?.length ?? 0;\n" +
  "  const isMine = post.authorId === user?.uid;\n" +
  "  const createdDate = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();\n\n" +
  "  return (\n" +
  "    <article className=\"border-b border-line bg-surface\">\n" +
  "      <div className=\"flex items-center gap-2.5 px-4 py-2.5\">\n" +
  "        <button onClick={() => onOpenProfile(post.authorId)}>\n" +
  "          <Avatar name={post.authorName} src={post.authorAvatar} size=\"sm\" />\n" +
  "        </button>\n" +
  "        <button onClick={() => onOpenProfile(post.authorId)} className=\"text-sm font-semibold text-ink\">{post.authorName}</button>\n" +
  "        <span className=\"ml-auto text-xs text-ink-soft\">{relativeTime(createdDate)}</span>\n" +
  "        {isMine && (\n" +
  "          <button onClick={() => deletePost(post.id)} aria-label=\"Delete post\" className=\"text-ink-soft hover:text-coral\"><Trash2 size={16} /></button>\n" +
  "        )}\n" +
  "      </div>\n\n" +
  "      <img src={post.imageUrl} alt={post.caption || 'Post'} onClick={() => onImageClick(post.imageUrl)} className=\"max-h-[70vh] w-full cursor-pointer bg-surface-alt object-contain\" />\n\n" +
  "      <div className=\"px-4 py-2.5\">\n" +
  "        <div className=\"flex items-center gap-4\">\n" +
  "          <button onClick={() => user && toggleLike(post.id, user.uid, liked)} className=\"flex items-center gap-1.5\" aria-label={liked ? 'Unlike' : 'Like'}>\n" +
  "            <Heart size={22} className={liked ? 'fill-coral text-coral' : 'text-ink'} strokeWidth={2} />\n" +
  "            {likeCount > 0 && <span className=\"text-sm font-medium text-ink\">{likeCount}</span>}\n" +
  "          </button>\n" +
  "          <button onClick={() => onOpenComments(post.id)} className=\"flex items-center gap-1.5\" aria-label=\"Comments\"><MessageCircle size={22} className=\"text-ink\" strokeWidth={2} /></button>\n" +
  "          <button onClick={() => onShare(post)} className=\"flex items-center gap-1.5\" aria-label=\"Share\"><Send size={22} className=\"text-ink\" strokeWidth={2} /></button>\n" +
  "          {onToggleSave && (\n" +
  "            <button onClick={onToggleSave} className=\"ml-auto flex items-center gap-1.5\" aria-label={saved ? 'Unsave' : 'Save'}>\n" +
  "              <Bookmark size={22} className={saved ? 'fill-ink text-ink' : 'text-ink'} strokeWidth={2} />\n" +
  "            </button>\n" +
  "          )}\n" +
  "        </div>\n" +
  "        {post.caption && (\n" +
  "          <p className=\"mt-1.5 text-sm text-ink\"><span className=\"font-semibold\">{post.authorName}</span> {post.caption}</p>\n" +
  "        )}\n" +
  "        <button onClick={() => onOpenComments(post.id)} className=\"mt-1 text-xs text-ink-soft\">View comments</button>\n" +
  "      </div>\n" +
  "    </article>\n" +
  "  );\n" +
  "}\n",
  "utf8"
);
console.log("[OK] PostCard.tsx rewritten with bookmark.");

// ==================== HomePage.tsx: wire saved into PostCard ====================

patchFile(
  "src/pages/HomePage.tsx",
  "import { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';",
  "import { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';\nimport { useSavedItems } from '../hooks/useSavedItems';\nimport { saveItem, unsaveItem } from '../firebase/saved';",
  "HomePage.tsx import useSavedItems"
);

patchFile(
  "src/pages/HomePage.tsx",
  "  const [storyStart, setStoryStart] = useState<number | null>(null);",
  "  const { isSaved } = useSavedItems(user?.uid);\n  const [storyStart, setStoryStart] = useState<number | null>(null);",
  "HomePage.tsx useSavedItems hook"
);

patchFile(
  "src/pages/HomePage.tsx",
  "            onShare={(p) => setShareContent({ kind: 'post', id: p.id, imageUrl: p.imageUrl, caption: p.caption, authorName: p.authorName })}\n          />\n        ))}",
  "            onShare={(p) => setShareContent({ kind: 'post', id: p.id, imageUrl: p.imageUrl, caption: p.caption, authorName: p.authorName })}\n            saved={isSaved('post', post.id)}\n            onToggleSave={() => user && (isSaved('post', post.id)\n              ? unsaveItem(user.uid, 'post', post.id)\n              : saveItem({ userId: user.uid, type: 'post', refId: post.id, title: post.caption || 'Post', imageUrl: post.imageUrl, authorName: post.authorName }))}\n          />\n        ))}",
  "HomePage.tsx PostCard save wiring"
);

// ==================== ReelItem.tsx (full rewrite -- reconstructed + bookmark) ====================

fs.writeFileSync("src/components/reels/ReelItem.tsx",
  "import { useEffect, useRef, useState } from 'react';\n" +
  "import { Heart, MessageCircle, Send, Volume2, VolumeX, Play, Trash2, Bookmark } from 'lucide-react';\n" +
  "import Avatar from '../shared/Avatar';\n" +
  "import type { Reel } from '../../types';\n" +
  "import { toggleReelLike } from '../../firebase/reels';\n" +
  "import { useAuth } from '../../context/AuthContext';\n\n" +
  "interface ReelItemProps {\n" +
  "  reel: Reel;\n" +
  "  active: boolean;\n" +
  "  muted: boolean;\n" +
  "  onToggleMute: () => void;\n" +
  "  onOpenProfile: (uid: string) => void;\n" +
  "  onOpenComments: (reelId: string) => void;\n" +
  "  onShare: (reel: Reel) => void;\n" +
  "  onDelete: (reel: Reel) => void;\n" +
  "  saved?: boolean;\n" +
  "  onToggleSave?: () => void;\n" +
  "}\n\n" +
  "export default function ReelItem({\n" +
  "  reel, active, muted, onToggleMute, onOpenProfile, onOpenComments, onShare, onDelete, saved, onToggleSave,\n" +
  "}: ReelItemProps) {\n" +
  "  const { user } = useAuth();\n" +
  "  const videoRef = useRef<HTMLVideoElement | null>(null);\n" +
  "  const [paused, setPaused] = useState(false);\n" +
  "  const liked = reel.likes?.includes(user?.uid || '') ?? false;\n" +
  "  const isMine = reel.authorId === user?.uid;\n\n" +
  "  useEffect(() => {\n" +
  "    const v = videoRef.current;\n" +
  "    if (!v) return;\n" +
  "    if (active) {\n" +
  "      v.currentTime = 0;\n" +
  "      v.play().then(() => setPaused(false)).catch(() => setPaused(true));\n" +
  "    } else {\n" +
  "      v.pause();\n" +
  "    }\n" +
  "  }, [active]);\n\n" +
  "  useEffect(() => {\n" +
  "    const v = videoRef.current;\n" +
  "    if (v) v.muted = muted;\n" +
  "  }, [muted]);\n\n" +
  "  function togglePlay() {\n" +
  "    const v = videoRef.current;\n" +
  "    if (!v) return;\n" +
  "    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }\n" +
  "  }\n\n" +
  "  return (\n" +
  "    <div className=\"relative h-full w-full snap-start bg-black\">\n" +
  "      <video ref={videoRef} src={reel.videoUrl} poster={reel.thumbUrl} loop muted={muted} playsInline onClick={togglePlay} className=\"h-full w-full object-contain\" />\n\n" +
  "      {paused && (\n" +
  "        <button onClick={togglePlay} className=\"absolute inset-0 flex items-center justify-center\" aria-label=\"Play\">\n" +
  "          <Play size={56} className=\"fill-white/80 text-white/80 drop-shadow-lg\" />\n" +
  "        </button>\n" +
  "      )}\n\n" +
  "      <button onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className=\"absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] rounded-full bg-black/40 p-2 text-white\">\n" +
  "        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}\n" +
  "      </button>\n\n" +
  "      <div className=\"absolute bottom-24 right-3 flex flex-col items-center gap-5\">\n" +
  "        <button onClick={() => user && toggleReelLike(reel.id, user.uid, liked)} className=\"flex flex-col items-center gap-1 text-white\" aria-label=\"Like\">\n" +
  "          <Heart size={30} className={liked ? 'fill-coral text-coral' : ''} />\n" +
  "          <span className=\"text-xs font-semibold\">{reel.likes?.length || 0}</span>\n" +
  "        </button>\n" +
  "        <button onClick={() => onOpenComments(reel.id)} className=\"flex flex-col items-center gap-1 text-white\" aria-label=\"Comments\"><MessageCircle size={30} /></button>\n" +
  "        <button onClick={() => onShare(reel)} className=\"flex flex-col items-center gap-1 text-white\" aria-label=\"Share\"><Send size={28} /></button>\n" +
  "        {onToggleSave && (\n" +
  "          <button onClick={onToggleSave} className=\"flex flex-col items-center gap-1 text-white\" aria-label={saved ? 'Unsave' : 'Save'}>\n" +
  "            <Bookmark size={28} className={saved ? 'fill-white' : ''} />\n" +
  "          </button>\n" +
  "        )}\n" +
  "        {isMine && (\n" +
  "          <button onClick={() => onDelete(reel)} className=\"flex flex-col items-center gap-1 text-white\" aria-label=\"Delete\"><Trash2 size={26} /></button>\n" +
  "        )}\n" +
  "      </div>\n\n" +
  "      <div className=\"absolute bottom-6 left-4 right-20\">\n" +
  "        <button onClick={() => onOpenProfile(reel.authorId)} className=\"mb-1.5 flex items-center gap-2\">\n" +
  "          <Avatar name={reel.authorName} src={reel.authorAvatar} size=\"sm\" />\n" +
  "          <span className=\"text-sm font-semibold text-white drop-shadow\">{reel.authorName}</span>\n" +
  "        </button>\n" +
  "        {reel.caption && <p className=\"text-sm text-white/90 drop-shadow\">{reel.caption}</p>}\n" +
  "      </div>\n" +
  "    </div>\n" +
  "  );\n" +
  "}\n",
  "utf8"
);
console.log("[OK] ReelItem.tsx rewritten with bookmark.");

// ==================== ReelsPage.tsx: wire saved into ReelItem ====================

patchFile(
  "src/pages/ReelsPage.tsx",
  "import { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';",
  "import { useLiveProfiles, liveName, liveAvatar } from '../hooks/useLiveProfiles';\nimport { useSavedItems } from '../hooks/useSavedItems';\nimport { saveItem, unsaveItem } from '../firebase/saved';\nimport { useAuth } from '../context/AuthContext';",
  "ReelsPage.tsx import useSavedItems"
);

patchFile(
  "src/pages/ReelsPage.tsx",
  "  const profiles = useLiveProfiles((reels || []).map((r) => r.authorId));",
  "  const profiles = useLiveProfiles((reels || []).map((r) => r.authorId));\n  const { user } = useAuth();\n  const { isSaved } = useSavedItems(user?.uid);",
  "ReelsPage.tsx useSavedItems hook"
);

patchFile(
  "src/pages/ReelsPage.tsx",
  "              onShare={(r) => setShareContent({ kind: 'reel', id: r.id, thumbUrl: r.thumbUrl, caption: r.caption, authorName: r.authorName })}\n              onDelete={setDeleteTarget}\n            />",
  "              onShare={(r) => setShareContent({ kind: 'reel', id: r.id, thumbUrl: r.thumbUrl, caption: r.caption, authorName: r.authorName })}\n              onDelete={setDeleteTarget}\n              saved={isSaved('reel', reel.id)}\n              onToggleSave={() => user && (isSaved('reel', reel.id)\n                ? unsaveItem(user.uid, 'reel', reel.id)\n                : saveItem({ userId: user.uid, type: 'reel', refId: reel.id, title: reel.caption || 'Reel', imageUrl: reel.thumbUrl, authorName: reel.authorName }))}\n            />",
  "ReelsPage.tsx ReelItem save wiring"
);

// ==================== ChatPage.tsx: wire saved + edit into MessageBubble ====================

patchFile(
  "src/pages/ChatPage.tsx",
  "import { sendMessage, toggleReaction, deleteOwnMessage, reportMessage, sendPoll, voteOnPoll, closePoll } from '../firebase/chat';",
  "import { sendMessage, toggleReaction, deleteOwnMessage, reportMessage, sendPoll, voteOnPoll, closePoll, editMessage } from '../firebase/chat';\nimport { useSavedItems } from '../hooks/useSavedItems';\nimport { saveItem, unsaveItem } from '../firebase/saved';",
  "ChatPage.tsx imports"
);

patchFile(
  "src/pages/ChatPage.tsx",
  "  const profiles = useLiveProfiles((messages || []).map((m) => m.senderId));",
  "  const profiles = useLiveProfiles((messages || []).map((m) => m.senderId));\n  const { isSaved } = useSavedItems(user?.uid);",
  "ChatPage.tsx useSavedItems hook"
);

patchFile(
  "src/pages/ChatPage.tsx",
  "            onVotePoll={(optionId) => voteOnPoll(m.id, optionId, user.uid)}\n            onClosePoll={() => closePoll(m.id)}\n          />\n        ))}",
  "            onVotePoll={(optionId) => voteOnPoll(m.id, optionId, user.uid)}\n            onClosePoll={() => closePoll(m.id)}\n            onEditMessage={(newText) => editMessage(m.id, newText)}\n            saved={isSaved('message', m.id)}\n            onToggleSave={() => isSaved('message', m.id)\n              ? unsaveItem(user.uid, 'message', m.id)\n              : saveItem({ userId: user.uid, type: 'message', refId: m.id, title: m.text || 'Message', imageUrl: m.imageUrl, authorName: m.senderName })}\n          />\n        ))}",
  "ChatPage.tsx MessageBubble edit + save wiring"
);

// ==================== ConversationScreen.tsx: wire saved + edit into DMBubble ====================

patchFile(
  "src/components/dm/ConversationScreen.tsx",
  "import { sendDM, toggleDMReaction, deleteDMMessage, voteOnDMPoll, closeDMPoll } from '../../firebase/dm';",
  "import { sendDM, toggleDMReaction, deleteDMMessage, voteOnDMPoll, closeDMPoll, editDMMessage } from '../../firebase/dm';\nimport { useSavedItems } from '../../hooks/useSavedItems';\nimport { saveItem, unsaveItem } from '../../firebase/saved';",
  "ConversationScreen.tsx imports"
);

patchFile(
  "src/components/dm/ConversationScreen.tsx",
  "  const profiles = useLiveProfiles((messages || []).map((m) => m.senderId));",
  "  const profiles = useLiveProfiles((messages || []).map((m) => m.senderId));\n  const { isSaved } = useSavedItems(user?.uid);",
  "ConversationScreen.tsx useSavedItems hook"
);

patchFile(
  "src/components/dm/ConversationScreen.tsx",
  "            onVotePoll={(optionId) => voteOnDMPoll(conversation.id, m.id, optionId, user.uid)}\n            onClosePoll={() => closeDMPoll(conversation.id, m.id)}\n          />\n        ))}",
  "            onVotePoll={(optionId) => voteOnDMPoll(conversation.id, m.id, optionId, user.uid)}\n            onClosePoll={() => closeDMPoll(conversation.id, m.id)}\n            onEditMessage={(newText) => editDMMessage(conversation.id, m.id, newText)}\n            saved={isSaved('dmMessage', m.id)}\n            onToggleSave={() => isSaved('dmMessage', m.id)\n              ? unsaveItem(user.uid, 'dmMessage', m.id)\n              : saveItem({ userId: user.uid, type: 'dmMessage', refId: m.id, conversationId: conversation.id, title: m.text || 'Message', imageUrl: m.imageUrl, authorName: m.senderName })}\n          />\n        ))}",
  "ConversationScreen.tsx DMBubble edit + save wiring"
);

// ==================== StudyHelpPage.tsx: bookmark on material cards ====================

patchFile(
  "src/pages/StudyHelpPage.tsx",
  "import { Plus, Search, Trash2, Download } from 'lucide-react';",
  "import { Plus, Search, Trash2, Download, Bookmark } from 'lucide-react';",
  "StudyHelpPage.tsx icon import"
);

patchFile(
  "src/pages/StudyHelpPage.tsx",
  "import { useAuth } from '../context/AuthContext';\nimport { relativeTime } from '../utils/date';\nimport type { StudyMaterial } from '../types';",
  "import { useAuth } from '../context/AuthContext';\nimport { useSavedItems } from '../hooks/useSavedItems';\nimport { saveItem, unsaveItem } from '../firebase/saved';\nimport { relativeTime } from '../utils/date';\nimport type { StudyMaterial } from '../types';",
  "StudyHelpPage.tsx import useSavedItems"
);

patchFile(
  "src/pages/StudyHelpPage.tsx",
  "  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);",
  "  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);\n  const { isSaved } = useSavedItems(user?.uid);",
  "StudyHelpPage.tsx useSavedItems hook"
);

patchFile(
  "src/pages/StudyHelpPage.tsx",
  "                          <div className=\"flex items-center gap-1.5\">\n                            <a\n                              href={m.imageUrl}\n                              target=\"_blank\"\n                              rel=\"noreferrer\"\n                              className=\"text-ink-soft hover:text-accent\"\n                              aria-label=\"Open / download\"\n                            >\n                              <Download size={13} />\n                            </a>",
  "                          <div className=\"flex items-center gap-1.5\">\n                            <button\n                              onClick={() => user && (isSaved('study', m.id)\n                                ? unsaveItem(user.uid, 'study', m.id)\n                                : saveItem({ userId: user.uid, type: 'study', refId: m.id, title: m.title, imageUrl: m.imageUrl, authorName: m.uploaderName }))}\n                              aria-label={isSaved('study', m.id) ? 'Unsave' : 'Save'}\n                              className={isSaved('study', m.id) ? 'text-accent' : 'text-ink-soft hover:text-accent'}\n                            >\n                              <Bookmark size={13} className={isSaved('study', m.id) ? 'fill-current' : ''} />\n                            </button>\n                            <a\n                              href={m.imageUrl}\n                              target=\"_blank\"\n                              rel=\"noreferrer\"\n                              className=\"text-ink-soft hover:text-accent\"\n                              aria-label=\"Open / download\"\n                            >\n                              <Download size={13} />\n                            </a>",
  "StudyHelpPage.tsx bookmark button"
);

// ==================== ProfilePage.tsx: Saved nav row ====================

patchFile(
  "src/pages/ProfilePage.tsx",
  "import { useState } from 'react';\nimport { Pencil, Megaphone, Info, Grid3x3 } from 'lucide-react';",
  "import { useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { Pencil, Megaphone, Info, Grid3x3, Bookmark } from 'lucide-react';",
  "ProfilePage.tsx imports"
);

patchFile(
  "src/pages/ProfilePage.tsx",
  "export default function ProfilePage() {\n  const { user, profile } = useAuth();",
  "export default function ProfilePage() {\n  const navigate = useNavigate();\n  const { user, profile } = useAuth();",
  "ProfilePage.tsx useNavigate"
);

patchFile(
  "src/pages/ProfilePage.tsx",
  "        <button\n          onClick={() => setAnnounceOpen(true)}",
  "        <button\n          onClick={() => navigate('/saved')}\n          className=\"flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left\"\n        >\n          <Bookmark size={18} className=\"text-accent\" />\n          <div>\n            <p className=\"text-sm font-semibold text-ink\">Saved</p>\n            <p className=\"text-xs text-ink-soft\">Posts, reels, messages, and study material you've saved</p>\n          </div>\n        </button>\n\n        <button\n          onClick={() => setAnnounceOpen(true)}",
  "ProfilePage.tsx Saved nav row"
);

// ==================== App.tsx: /saved route ====================

patchFile(
  "src/App.tsx",
  "const TimetablePage = lazy(() => import('./pages/TimetablePage'));",
  "const TimetablePage = lazy(() => import('./pages/TimetablePage'));\nconst SavedPage = lazy(() => import('./pages/SavedPage'));",
  "App.tsx lazy import SavedPage"
);

patchFile(
  "src/App.tsx",
  "              <Route path=\"/timetable\" element={<TimetablePage />} />",
  "              <Route path=\"/timetable\" element={<TimetablePage />} />\n              <Route path=\"/saved\" element={<SavedPage />} />",
  "App.tsx saved route"
);

// ==================== firestore.rules ====================

patchFile(
  "firestore.rules",
  "        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deleted', 'text', 'imageUrl', 'reactions']))",
  "        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deleted', 'text', 'imageUrl', 'reactions', 'edited']))",
  "firestore.rules class chat allow edited field"
);

patchFile(
  "firestore.rules",
  "    // ---- Reminders: fully private to the owner; only the server (Admin SDK) marks them sent ----",
  "    // ---- Saved items: fully private bookmarks, owner-only ----\n    match /saved/{id} {\n      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;\n      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;\n      allow update: if false;\n      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;\n    }\n\n    // ---- Reminders: fully private to the owner; only the server (Admin SDK) marks them sent ----",
  "firestore.rules saved collection"
);

console.log("\nSUCCESS -- reached the end of the script with no crash.");

} catch (err) {
  console.error("\n!!! SCRIPT CRASHED !!!");
  console.error(err.message);
  console.error(err.stack);
}
