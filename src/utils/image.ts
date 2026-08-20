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
