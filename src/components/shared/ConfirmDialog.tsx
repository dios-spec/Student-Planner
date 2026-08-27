import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-ink-soft">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-alt"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${
            danger ? 'bg-coral' : 'bg-accent'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
