import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { TranscriptSegment } from '../types';
import { Search, Copy, Check, ChevronDown, ChevronRight, ArrowDown } from 'lucide-react';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  interimText: string;
  isLive: boolean;
  knownTerms: string[];
  termsInput: string;
  onTermsChange: (val: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  segments,
  interimText,
  isLive,
  knownTerms,
  termsInput,
  onTermsChange,
  searchInputRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const localSearchInputRef = useRef<HTMLInputElement | null>(null);

  const activeSearchRef = searchInputRef || localSearchInputRef;

  // Filter segments by search query
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const query = searchQuery.toLowerCase();
    return segments.filter((seg) => seg.text.toLowerCase().includes(query));
  }, [segments, searchQuery]);

  // Windowing for very large transcripts (>500 segments)
  const visibleSegments = useMemo(() => {
    if (filteredSegments.length > 500) {
      return filteredSegments.slice(-500);
    }
    return filteredSegments;
  }, [filteredSegments]);

  // Compute total word count
  const totalWords = useMemo(() => {
    return segments.reduce((acc, seg) => {
      return acc + seg.text.trim().split(/\s+/).filter(Boolean).length;
    }, 0);
  }, [segments]);

  // Auto-scroll handler
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setIsAutoScrollPaused(false);
  }, []);

  // Detect manual scroll-up
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (!isAtBottom) {
      setIsAutoScrollPaused(true);
    } else {
      setIsAutoScrollPaused(false);
    }
  };

  // Perform auto-scroll when new text arrives, unless paused by user
  useEffect(() => {
    if (!isAutoScrollPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [segments, interimText, isAutoScrollPaused]);

  const handleCopyTranscript = () => {
    const fullText = segments.map((s) => `[${s.startedAt}] ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] rounded-panel border border-[var(--line)] shadow-calm overflow-hidden transition-colors">
      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-scale-16 font-semibold text-[var(--ink)]">Transcript</h2>
          <span className="text-scale-12 text-[var(--ink-3)] font-mono flex items-center gap-1.5">
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" title="Capturing speech" />}
            <span>{totalWords} words &bull; {segments.length} turns</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Field */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
            <input
              ref={activeSearchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter transcript (/)"
              className="pl-8 pr-2.5 py-1.5 text-scale-12 rounded-control border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)] w-36 sm:w-48 transition-colors focus-visible:ring-2"
            />
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyTranscript}
            disabled={segments.length === 0}
            aria-label="Copy transcript"
            title="Copy all transcript text"
            className="p-1.5 rounded-control border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--done)]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible "Names and terms" row */}
      <div className="border-b border-[var(--line)] bg-[var(--surface-2)]/50 transition-colors">
        <button
          onClick={() => setIsTermsOpen((prev) => !prev)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-left text-scale-13 text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors focus-visible:ring-2"
        >
          <div className="flex items-center gap-2">
            {isTermsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-3)]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-3)]" />
            )}
            <span className="font-medium text-[var(--ink)]">Names and terms</span>
            {knownTerms.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-scale-12 font-medium bg-[var(--surface)] border border-[var(--line)] text-[var(--cobalt)]">
                {knownTerms.length} {knownTerms.length === 1 ? 'name' : 'names'}
              </span>
            )}
          </div>
          <span className="text-scale-12 text-[var(--ink-3)] hidden sm:inline">
            Corrects misheard speech
          </span>
        </button>

        {isTermsOpen && (
          <div className="px-5 pb-3.5 pt-1 space-y-1.5 animate-in fade-in duration-150">
            <label htmlFor="known-terms-field" className="block text-scale-12 text-[var(--ink-3)]">
              Add names so we can correct mis-heard words.
            </label>
            <input
              id="known-terms-field"
              type="text"
              value={termsInput}
              onChange={(e) => onTermsChange(e.target.value)}
              placeholder="e.g. Ravi, Priya, LiveScribe (comma-separated)"
              className="w-full px-3 py-1.5 text-scale-13 rounded-control border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus-visible:ring-2"
            />
          </div>
        )}
      </div>

      {/* Transcript Log Container */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          aria-live="polite"
          className="h-full overflow-y-auto px-5 py-4 space-y-4"
        >
          {visibleSegments.length === 0 && !interimText ? (
            /* Quiet Calm Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
              <h3 className="font-serif text-scale-28 text-[var(--ink)] mb-2 tracking-tight">
                Say it once. We'll keep the notes.
              </h3>
              <p className="text-scale-15 text-[var(--ink-2)] max-w-[46ch] leading-relaxed">
                Press <span className="font-medium text-[var(--ink)]">Start listening</span> and talk
                through who does what by when.
              </p>
            </div>
          ) : (
            <>
              {visibleSegments.map((segment) => (
                <div
                  key={segment.id}
                  className="group flex items-start gap-4 text-left leading-relaxed transition-colors"
                >
                  {/* Time Rail */}
                  <div className="w-20 shrink-0 pt-0.5 text-right font-mono text-scale-12 text-[var(--ink-3)] select-none whitespace-nowrap">
                    {segment.startedAt}
                  </div>

                  {/* Final Text */}
                  <div className="flex-1 text-scale-15 text-[var(--ink)]">
                    <p className="whitespace-pre-wrap">{segment.text}</p>
                  </div>
                </div>
              ))}

              {/* Interim Speculative Text (Soft Italic Style) */}
              {interimText && (
                <div className="flex items-start gap-4 text-left leading-relaxed">
                  <div className="w-20 shrink-0 pt-0.5 text-right font-mono text-scale-12 text-[var(--cobalt)] select-none animate-pulse whitespace-nowrap">
                    live
                  </div>
                  <div className="flex-1 text-scale-15 italic text-[var(--ink-2)]">
                    <p className="whitespace-pre-wrap">{interimText}</p>
                  </div>
                </div>
              )}

              <div ref={bottomRef} className="h-2" />
            </>
          )}
        </div>

        {/* Floating "Jump to latest" Button */}
        {isAutoScrollPaused && (
          <button
            onClick={scrollToBottom}
            aria-label="Jump to latest transcript"
            className="absolute bottom-4 right-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] shadow-calm text-scale-12 font-medium hover:bg-[var(--surface-2)] transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <ArrowDown className="w-3.5 h-3.5 text-[var(--cobalt)]" />
            <span>Jump to latest</span>
          </button>
        )}
      </div>
    </div>
  );
};
