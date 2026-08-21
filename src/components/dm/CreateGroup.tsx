import { useEffect, useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import Modal from '../shared/Modal';
import Avatar from '../shared/Avatar';
import { listAllProfiles, createGroup } from '../../firebase/conversations';
import { uploadAvatar } from '../../firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CLASSES, type ClassId } from '../../data/classes';
import type { StudentProfile } from '../../types';

export default function CreateGroup({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [classId, setClassId] = useState<ClassId | null>(null);
  const [people, setPeople] = useState<StudentProfile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) listAllProfiles(user.uid).then(setPeople);
  }, [open, user]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePhoto(file: File) {
    if (!user) return;
    try {
      const url = await uploadAvatar(file, user.uid);
      setPhotoUrl(url);
    } catch { show("Couldn't upload photo."); }
  }

  async function handleCreate() {
    if (!user || !profile || !name.trim() || selected.size === 0) return;
    setCreating(true);
    try {
      const memberProfiles = people.filter((p) => selected.has(p.id));
      const id = await createGroup({
        name: name.trim(),
        description: desc.trim() || undefined,
        photoUrl,
        classId: classId || undefined,
        creator: profile,
        memberProfiles,
      });
      show('Group created!');
      setName(''); setDesc(''); setPhotoUrl(undefined); setClassId(null); setSelected(new Set());
      onCreated(id);
    } catch {
      show("Couldn't create group.");
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Group" fullHeight>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Group photo">
            <Avatar name={name || 'Group'} src={photoUrl} size="lg" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-accent p-1.5 text-white"><Camera size={12} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ''; }} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="Group name"
            className="flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, 120))}
          placeholder="Description (optional)"
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-accent"
        />

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Class (optional)</p>
          <div className="flex gap-2">
            {CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => setClassId((cur) => (cur === c ? null : c))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  classId === c ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-soft'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Add members ({selected.size})</p>
          <div className="space-y-1">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-alt"
              >
                <Avatar name={p.displayName} src={p.avatarUrl} emoji={p.emoji} size="sm" />
                <span className="flex-1 truncate text-sm text-ink">{p.displayName}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                  selected.has(p.id) ? 'border-accent bg-accent text-white' : 'border-line'
                }`}>
                  {selected.has(p.id) && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            ))}
            {people.length === 0 && <p className="py-4 text-center text-sm text-ink-soft">No other students yet.</p>}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || selected.size === 0}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create Group'}
        </button>
      </div>
    </Modal>
  );
}
