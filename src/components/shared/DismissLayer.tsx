import { useEffect } from 'react';

/**
 * The invisible full-screen layer that closes an open popover menu.
 *
 * Three screens each had their own copy of `<div className="fixed inset-0 z-10"
 * onClick={close} />`. They worked with a mouse or finger and were completely
 * inert on a keyboard: there was no way to dismiss an open menu without
 * clicking somewhere. This adds Escape handling in one place, and keeps the
 * stacking context consistent between the three.
 *
 * Deliberately not a button: it is a supplementary way to dismiss, and the menu
 * items behind it are already real, focusable buttons.
 */
export default function DismissLayer({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return <div className="fixed inset-0 z-10" aria-hidden="true" onClick={onDismiss} />;
}
