import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { StudyMaterial } from '../types';
import { pushToClass } from './notifications';

const col = collection(db, 'studyMaterials');

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  return clean;
}

export interface NewStudyMaterial {
  classId: string;
  subject: string;
  chapter: string;
  title: string;
  imageUrl: string;
  uploaderId: string;
  uploaderName: string;
  uploaderAvatar?: string;
}

export async function addStudyMaterial(m: NewStudyMaterial) {
  await addDoc(col, stripUndefined({ ...m, createdAt: serverTimestamp() }));

  void pushToClass(
    m.classId,
    {
      type: 'homework',
      title: 'New Study Help material',
      body: `${m.subject} • ${m.chapter}: ${m.title}`,
      icon: m.uploaderAvatar,
      route: '/study',
      data: { classId: m.classId, subject: m.subject, chapter: m.chapter },
    },
    m.uploaderId
  ).catch(() => {});
}

/** Live listener for one class's study materials, newest first. */
export function watchStudyMaterials(classId: string, cb: (items: StudyMaterial[]) => void) {
  const q = query(col, where('classId', '==', classId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudyMaterial));
  });
}

/** Uploader-only delete. */
export async function deleteStudyMaterial(id: string) {
  await deleteDoc(doc(col, id));
}
