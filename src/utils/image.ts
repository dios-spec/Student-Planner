/** Compresses/resizes an image in the browser before it's uploaded to Storage. */
export async function compressImage(
  file: File,
  { maxDimension = 1600, quality = 0.75 }: { maxDimension?: number; quality?: number } = {}
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      'image/jpeg',
      quality
    );
  });
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB pre-compression cap

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "That file type isn't supported.";
  if (file.size > MAX_UPLOAD_BYTES) return 'Image is too large (max 8MB).';
  return null;
}

// ---- Video validation for Reels (protects Cloudinary free quota) ----
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30MB hard cap
export const MAX_VIDEO_SECONDS = 60;             // 60s max duration

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) return 'Please choose an MP4 or WebM video.';
  if (file.size > MAX_VIDEO_BYTES) return 'Video is too large (max 30MB).';
  return null;
}

/** Reads a video file's duration in the browser without uploading it. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video'));
    };
    video.src = url;
  });
}
