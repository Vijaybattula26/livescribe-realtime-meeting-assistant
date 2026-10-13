import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--line)] rounded-panel p-6 shadow-calm text-[var(--ink)]">
        <div className="flex items-start justify-between pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-control ${
                isDestructive
                  ? 'bg-[var(--live)]/10 text-[var(--live)]'
                  : 'bg-[var(--amber)]/10 text-[var(--amber)]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 id="confirm-modal-title" className="text-scale-16 font-semibold">
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 rounded-control text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors focus-visible:ring-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p id="confirm-modal-desc" className="text-scale-13 text-[var(--ink-2)] leading-relaxed my-3">
          {description}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--line)]">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 text-scale-13 font-medium rounded-control border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--ink)] transition-colors focus-visible:ring-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-scale-13 font-medium rounded-control text-white transition-all shadow-sm focus-visible:ring-2 ${
              isDestructive
                ? 'bg-[var(--live)] hover:brightness-110'
                : 'bg-[var(--cobalt)] hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
