import React, { useState, useEffect } from 'react';
import { ActionItem, Priority, TaskStatus } from '../types';
import { X, Check } from 'lucide-react';

interface ActionItemModalProps {
  isOpen: boolean;
  item: ActionItem | null;
  onClose: () => void;
  onSave: (item: Omit<ActionItem, 'id'> | ActionItem) => void;
}

export const ActionItemModal: React.FC<ActionItemModalProps> = ({
  isOpen,
  item,
  onClose,
  onSave,
}) => {
  const [task, setTask] = useState('');
  const [owner, setOwner] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('open');
  const [sourceQuote, setSourceQuote] = useState('');

  useEffect(() => {
    if (item) {
      setTask(item.task);
      setOwner(item.owner || '');
      setDeadline(item.deadline || '');
      setPriority(item.priority);
      setStatus(item.status);
      setSourceQuote(item.sourceQuote || '');
    } else {
      setTask('');
      setOwner('');
      setDeadline('');
      setPriority('medium');
      setStatus('open');
      setSourceQuote('');
    }
  }, [item, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) return;

    if (item) {
      onSave({
        ...item,
        task: task.trim(),
        owner: owner.trim() || null,
        deadline: deadline.trim() || null,
        priority,
        status,
        sourceQuote: sourceQuote.trim(),
        isManual: true,
      });
    } else {
      onSave({
        task: task.trim(),
        owner: owner.trim() || null,
        deadline: deadline.trim() || null,
        priority,
        status,
        confidence: 1.0,
        sourceQuote: sourceQuote.trim() || 'Manually added',
        isManual: true,
      });
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--line)] rounded-panel p-6 shadow-calm text-[var(--ink)]">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
          <h3 id="action-modal-title" className="text-scale-16 font-semibold">
            {item ? 'Edit action item' : 'New action item'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-control text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors focus-visible:ring-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div>
            <label className="block text-scale-12 font-medium text-[var(--ink-2)] mb-1">
              Task description *
            </label>
            <input
              type="text"
              required
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Send revenue report to board"
              className="w-full px-3 py-2 text-scale-13 rounded-control border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus-visible:ring-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-scale-12 font-medium text-[var(--ink-2)] mb-1">
                Owner
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Ravi"
                className="w-full px-3 py-2 text-scale-13 rounded-control border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus-visible:ring-2"
              />
            </div>
            <div>
              <label className="block text-scale-12 font-medium text-[var(--ink-2)] mb-1">
                Deadline
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="e.g. Friday, 5 PM"
                className="w-full px-3 py-2 text-scale-13 rounded-control border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-scale-12 font-medium text-[var(--ink-2)] mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 text-scale-13 rounded-control border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] focus-visible:ring-2"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-scale-12 font-medium text-[var(--ink-2)] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-scale-13 rounded-control border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] focus-visible:ring-2"
              >
                <option value="open">Open</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-scale-12 font-medium text-[var(--ink-2)] mb-1">
              Source quote (optional)
            </label>
            <input
              type="text"
              value={sourceQuote}
              onChange={(e) => setSourceQuote(e.target.value)}
              placeholder="e.g. 'Ravi will send the revenue report'"
              className="w-full px-3 py-2 text-scale-13 rounded-control border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus-visible:ring-2"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-scale-13 font-medium rounded-control text-[var(--ink-2)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-scale-13 font-medium rounded-control bg-[var(--cobalt)] hover:bg-[var(--cobalt-hover)] text-white shadow-sm transition-all focus-visible:ring-2"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save item</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
