import { compressImage, validateImageFile } from '../utils/image';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

async function uploadToCloudinary(blob: Blob, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.secure_url as string;
}

export async function uploadChatImage(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 1600, quality: 0.75 });
  return uploadToCloudinary(blob, `chatImages/${uid}`);
}

export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 400, quality: 0.8 });
  return uploadToCloudinary(blob, `avatars/${uid}`);
}

export async function uploadPostImage(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 1400, quality: 0.8 });
  return uploadToCloudinary(blob, `posts/${uid}`);
}

export async function uploadStoryImage(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 1200, quality: 0.8 });
  return uploadToCloudinary(blob, `stories/${uid}`);
}

export async function uploadStudyImage(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 2000, quality: 0.82 });
  return uploadToCloudinary(blob, `study/${uid}`);
}

/** Uploads a recorded voice clip. Cloudinary serves audio via its video endpoint. */
export async function uploadVoiceClip(blob: Blob, uid: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `voice/${uid}`);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) throw new Error('Voice upload failed');
  const data = await res.json();
  return data.secure_url as string;
}

export async function uploadDMImage(file: File, uid: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const blob = await compressImage(file, { maxDimension: 1400, quality: 0.78 });
  return uploadToCloudinary(blob, `dm/${uid}`);
}

/** Uploads a Reel video to Cloudinary with server-side transformation to cap size/quality.
 *  Returns both the playable video URL and a generated thumbnail URL. */
export async function uploadReelVideo(
  file: File,
  uid: string
): Promise<{ videoUrl: string; thumbUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `reels/${uid}`);

  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/video/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Video upload failed');
  const data = await res.json();

  const publicId: string = data.public_id;
  // Cloudinary transformations: capped height, auto quality for streaming; jpg thumbnail.
  const videoUrl = `https://res.cloudinary.com/${cloud}/video/upload/q_auto,h_1280,c_limit/${publicId}.mp4`;
  const thumbUrl = `https://res.cloudinary.com/${cloud}/video/upload/so_0,h_640,c_limit,q_auto/${publicId}.jpg`;
  return { videoUrl, thumbUrl };
}

export async function uploadStoryVideo(file: File, uid: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `stories/${uid}`);
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/video/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Story video upload failed');
  const data = await res.json();
  return `https://res.cloudinary.com/${cloud}/video/upload/q_auto,h_1280,c_limit/${data.public_id}.mp4`;
}
