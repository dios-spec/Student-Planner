import { useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

/** Fullscreen image viewer with tap-to-zoom (double-tap or buttons). */
export default function ImagePreviewModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  if (!url) return null;

  function close() {
    setZoom(1);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="absolute right-4 top-4 z-10 flex gap-2 pt-[env(safe-area-inset-top)]">
        <button
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          aria-label="Zoom out"
          className="rounded-full bg-white/15 p-2 text-white"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
          aria-label="Zoom in"
          className="rounded-full bg-white/15 p-2 text-white"
        >
          <ZoomIn size={20} />
        </button>
        <button onClick={close} aria-label="Close" className="rounded-full bg-white/15 p-2 text-white">
          <X size={20} />
        </button>
      </div>

      <div className="h-full w-full overflow-auto" onClick={(e) => e.target === e.currentTarget && close()}>
        <img
          src={url}
          alt="Full size"
          onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
          style={{ transform: `scale(${zoom})` }}
          className="mx-auto max-h-full max-w-full origin-center cursor-zoom-in object-contain transition-transform"
        />
      </div>
    </div>
  );
}
