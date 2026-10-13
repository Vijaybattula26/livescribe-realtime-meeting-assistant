import React, { useEffect } from 'react';
import { X, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', description: 'Start or pause live audio capture' },
    { key: 'E', description: 'Extract meeting notes and action items immediately' },
    { key: '/', description: 'Focus search filter in transcript' },
    { key: '?', description: 'Open this keyboard shortcuts guide' },
    { key: 'Esc', description: 'Close dialogs and overlays' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--line)] rounded-panel p-6 shadow-calm text-[var(--ink)]">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <Command className="w-4 h-4 text-[var(--cobalt)]" />
            <h2 id="shortcuts-dialog-title" className="text-scale-16 font-semibold">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            className="p-1 rounded-control text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors focus-visible:ring-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="flex items-center justify-between text-scale-13">
              <span className="text-[var(--ink-2)]">{sc.description}</span>
              <kbd className="px-2.5 py-1 rounded bg-[var(--surface-2)] border border-[var(--line)] text-scale-12 font-mono font-medium text-[var(--ink)] shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[var(--line)] text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-control bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--line)] text-scale-13 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
