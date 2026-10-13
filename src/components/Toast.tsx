import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toast: { message: string; type: 'info' | 'error' | 'success' } | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const typeConfig = {
    info: {
      icon: Info,
      color: 'text-[var(--cobalt)]',
    },
    success: {
      icon: CheckCircle,
      color: 'text-[var(--done)]',
    },
    error: {
      icon: AlertCircle,
      color: 'text-[var(--live)]',
    },
  }[toast.type];

  const IconComponent = typeConfig.icon;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex items-start gap-3 p-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-control shadow-calm text-[var(--ink)]">
        <IconComponent className={`w-4 h-4 flex-shrink-0 mt-0.5 ${typeConfig.color}`} />
        <div className="flex-1 text-scale-13 leading-snug">{toast.message}</div>
        <button
          onClick={onDismiss}
          className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors focus-visible:ring-2"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
