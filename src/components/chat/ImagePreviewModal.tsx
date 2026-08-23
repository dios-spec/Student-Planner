import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

/** Fullscreen image viewer with tap-to-zoom (double-tap or buttons). */
export default function ImagePreviewModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!url) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setZoom(1);
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [url]);

  if (!url) return null;

  function close() {
    setZoom(1);
    onClose();
  }

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Image preview">
      <div className="absolute right-4 top-4 z-10 flex gap-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <ZoomOut size={20} />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <ZoomIn size={20} />
        </button>
        <button ref={closeRef} type="button" onClick={close} aria-label="Close image preview" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
          <X size={20} />
        </button>
      </div>

      <div className="h-full w-full overflow-auto" onClick={(e) => e.target === e.currentTarget && close()}>
        <img
          src={url}
          alt="Full size"
          decoding="async"
          onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
          style={{ transform: `scale(${zoom})` }}
          className="mx-auto max-h-full max-w-full origin-center cursor-zoom-in object-contain transition-transform"
        />
      </div>
    </div>
  );
}
