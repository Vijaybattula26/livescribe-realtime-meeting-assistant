import React, { useState, useEffect } from 'react';
import { TranscriptSegment, ExtractionState } from '../types';
import { exportToMarkdown, exportToJSON, downloadBlob } from '../utils/exportFormats';
import { X, FileText, Code, Copy, Check, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  segments: TranscriptSegment[];
  state: ExtractionState;
  sessionDuration: string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  segments,
  state,
  sessionDuration,
  onClose,
}) => {
  const [activeFormat, setActiveFormat] = useState<'markdown' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const mdContent = exportToMarkdown(segments, state, sessionDuration);
  const jsonContent = exportToJSON(segments, state, sessionDuration);
  const currentContent = activeFormat === 'markdown' ? mdContent : jsonContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (activeFormat === 'markdown') {
      downloadBlob(mdContent, `livescribe-notes-${timestamp}.md`, 'text/markdown');
    } else {
      downloadBlob(jsonContent, `livescribe-data-${timestamp}.json`, 'application/json');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="max-w-2xl w-full bg-[var(--surface)] border border-[var(--line)] rounded-panel p-6 shadow-calm flex flex-col max-h-[85vh] text-[var(--ink)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div>
            <h2 id="export-dialog-title" className="text-scale-16 font-semibold">
              Export notes and transcript
            </h2>
            <p className="text-scale-13 text-[var(--ink-2)] mt-0.5">
              Save or copy the formatted transcript, summary, and action items.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export dialog"
            className="p-1 rounded-control text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors focus-visible:ring-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-2 my-4">
          <button
            onClick={() => setActiveFormat('markdown')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-control text-scale-13 font-medium transition-colors ${
              activeFormat === 'markdown'
                ? 'bg-[var(--cobalt)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Markdown (.md)
          </button>
          <button
            onClick={() => setActiveFormat('json')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-control text-scale-13 font-medium transition-colors ${
              activeFormat === 'json'
                ? 'bg-[var(--cobalt)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            <Code className="w-4 h-4" />
            JSON (.json)
          </button>
        </div>

        {/* Code Preview */}
        <div className="flex-1 overflow-auto rounded-control bg-[var(--surface-2)] p-4 border border-[var(--line)] font-mono text-scale-12 text-[var(--ink)] leading-relaxed max-h-96">
          <pre className="whitespace-pre-wrap select-all font-mono">{currentContent}</pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-[var(--line)]">
          <span className="text-scale-12 text-[var(--ink-3)]">
            {segments.length} segments · {state.actionItems.length} action items
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-scale-13 font-medium rounded-control border border-[var(--line)] hover:bg-[var(--surface-2)] text-[var(--ink)] transition-colors focus-visible:ring-2"
            >
              {copied ? <Check className="w-4 h-4 text-[var(--done)]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy to clipboard'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-scale-13 font-medium rounded-control bg-[var(--cobalt)] hover:brightness-110 text-white transition-all shadow-sm focus-visible:ring-2"
            >
              <Download className="w-4 h-4" />
              <span>Download {activeFormat.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
