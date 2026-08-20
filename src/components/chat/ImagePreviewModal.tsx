import { X } from 'lucide-react';

export default function ImagePreviewModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <button aria-label="Close" className="absolute right-4 top-4 text-white">
        <X size={26} />
      </button>
      <img src={url} alt="Full size" className="max-h-full max-w-full rounded-lg object-contain" />
    </div>
  );
}
