import React, { useEffect } from 'react';
import { Shield, ExternalLink } from 'lucide-react';

interface ConsentBannerProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({ isOpen, onAccept }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Can be dismissed or focused
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="max-w-lg w-full bg-[var(--surface)] border border-[var(--line)] rounded-panel p-6 shadow-calm text-[var(--ink)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-control bg-[var(--surface-2)] text-[var(--cobalt)]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 id="consent-title" className="text-scale-16 font-semibold">
              Audio capture and privacy
            </h2>
            <p className="text-scale-13 text-[var(--ink-2)] mt-0.5">
              Review how audio is processed before listening starts.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-scale-13 text-[var(--ink-2)] leading-relaxed mb-6">
          <p>
            When you start listening, your microphone audio is streamed securely to Google Gemini for real-time transcription and extraction.
          </p>

          <ul className="space-y-2 text-scale-12 text-[var(--ink-2)] pl-1">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cobalt)] mt-1.5 flex-shrink-0" />
              <span>Audio is processed in real time and is never stored permanently on our servers.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cobalt)] mt-1.5 flex-shrink-0" />
              <span>Transcripts and notes are saved locally in your browser storage (IndexedDB).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cobalt)] mt-1.5 flex-shrink-0" />
              <span>You can export or permanently delete your data at any time from the menu.</span>
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
          <a
            href="https://ai.google.dev/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-scale-12 text-[var(--cobalt)] hover:underline inline-flex items-center gap-1 font-medium"
          >
            Google Gemini terms
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onAccept}
            className="px-4 py-2 text-scale-13 font-medium rounded-control bg-[var(--cobalt)] hover:brightness-110 text-white transition-all shadow-sm focus-visible:ring-2"
          >
            Agree and continue
          </button>
        </div>
      </div>
    </div>
  );
};
