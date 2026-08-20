import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './config';
import { compressImage, validateImageFile } from '../utils/image';

export async function uploadChatImage(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 1600, quality: 0.75 });
  const path = `chatImages/${uid}/${Date.now()}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 400, quality: 0.8 });
  const path = `avatars/${uid}/avatar.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
