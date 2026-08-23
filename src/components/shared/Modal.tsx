import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  fullHeight?: boolean;
}

/** A bottom sheet on mobile, a centered dialog on larger screens. */
export default function Modal({ open, onClose, title, children, fullHeight }: ModalProps) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (rendered) {
      setClosing(true);
      const t = window.setTimeout(() => {
        setRendered(false);
        setClosing(false);
      }, 180);
      return () => window.clearTimeout(t);
    }
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>('[autofocus]')
        || dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable || dialogRef.current)?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!rendered) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center pt-[env(safe-area-inset-top)] sm:items-center">
      <div
        className={`absolute inset-0 bg-black/40 ${closing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 w-full max-w-lg rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl ${
          fullHeight ? 'h-[85dvh]' : 'max-h-[85dvh]'
        } flex flex-col ${closing ? 'animate-modal-sheet-out' : 'animate-modal-sheet-in'}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-3 text-ink-soft hover:bg-surface-alt"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
