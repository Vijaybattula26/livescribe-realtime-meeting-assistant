import React, { useState, useRef, useEffect } from 'react';
import { LiveConnectionStatus } from '../types';
import {
  MoreVertical,
  Download,
  Copy,
  Clock,
  Sun,
  Moon,
  Trash2,
  RotateCcw,
  Sliders,
  Bug,
  Command,
  Play,
  Pause,
  Square,
  Radio,
} from 'lucide-react';

interface HeaderProps {
  status: LiveConnectionStatus;
  sessionDuration: string;
  latencyMs: number | null;
  intervalSeconds: number;
  isDarkMode: boolean;
  isDebugMode: boolean;
  onToggleDarkMode: () => void;
  onToggleDebugMode: () => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onClearSession: () => void;
  onOpenExport: () => void;
  onCopySummary: () => void;
  onSetInterval: (secs: number) => void;
  onDeleteAllData: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  sessionDuration,
  latencyMs,
  intervalSeconds,
  isDarkMode,
  isDebugMode,
  onToggleDarkMode,
  onToggleDebugMode,
  onStart,
  onStop,
  onPause,
  onResume,
  onClearSession,
  onOpenExport,
  onCopySummary,
  onSetInterval,
  onDeleteAllData,
  onOpenShortcuts,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isLive = status === 'live';
  const isPaused = status === 'paused';
  const isConnecting = status === 'connecting' || status === 'reconnecting';

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const statusConfig = {
    idle: { label: 'Idle', dotColor: 'bg-[var(--ink-3)]' },
    connecting: { label: 'Connecting', dotColor: 'bg-[var(--amber)] animate-pulse' },
    reconnecting: { label: 'Reconnecting', dotColor: 'bg-[var(--amber)] animate-pulse' },
    live: { label: 'Listening', dotColor: 'bg-[var(--live)] animate-pulse' },
    paused: { label: 'Paused', dotColor: 'bg-[var(--ink-2)]' },
    offline: { label: 'Offline', dotColor: 'bg-[var(--amber)]' },
    error: { label: 'Error', dotColor: 'bg-[var(--amber)]' },
  }[status];

  return (
    <header className="sticky top-0 z-30 bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--line)] transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Serif wordmark + Status pill + Latency */}
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[28px] leading-none tracking-tight text-[var(--ink)] select-none">
              LiveScribe
            </span>
          </div>

          {/* Status pill */}
          <div
            data-state={status}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--line)] text-scale-12 font-medium text-[var(--ink-2)] transition-all select-none"
          >
            <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
            <span>{statusConfig.label}</span>

            {/* Short latency badge when live */}
            {isLive && latencyMs !== null && (
              <span
                title="Speech-to-text latency"
                className="pl-1.5 ml-1 border-l border-[var(--line)] font-mono text-[11px] text-[var(--ink-3)]"
              >
                {latencyMs}ms
              </span>
            )}
          </div>
        </div>

        {/* Right: Timer + Primary Button + Overflow Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Timer in JetBrains Mono */}
          <div
            title="Session duration"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-[var(--surface-2)] border border-[var(--line)] font-mono text-scale-13 text-[var(--ink-2)] select-none"
          >
            <Clock className="w-3.5 h-3.5 text-[var(--ink-3)]" />
            <span>{sessionDuration}</span>
          </div>

          {/* Primary Action Button */}
          {!isLive && !isPaused ? (
            <button
              onClick={onStart}
              disabled={isConnecting}
              title="Start listening (Space)"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-control bg-[var(--cobalt)] hover:bg-[var(--cobalt-hover)] active:scale-[0.98] text-white font-medium text-scale-13 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Start listening</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              {isPaused ? (
                <button
                  onClick={onResume}
                  title="Resume listening (Space)"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-control bg-[var(--cobalt)] hover:bg-[var(--cobalt-hover)] active:scale-[0.98] text-white font-medium text-scale-13 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={onPause}
                  title="Pause listening (Space)"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-control bg-[var(--surface-2)] hover:bg-[var(--line)] border border-[var(--line)] text-[var(--ink)] font-medium text-scale-13 transition-all"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              )}
              <button
                onClick={onStop}
                title="Stop listening"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-control bg-[var(--live)] hover:opacity-90 active:scale-[0.98] text-white font-medium text-scale-13 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          {/* Overflow Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-label="More options"
              title="More options"
              className="w-9 h-9 flex items-center justify-center rounded-control border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors focus-visible:ring-2"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 bg-[var(--surface)] border border-[var(--line)] rounded-control shadow-calm py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Extraction Interval */}
                <div className="px-3 py-2 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2 text-scale-12 font-medium text-[var(--ink-2)] mb-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Auto-extraction interval</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[15, 30, 60].map((secs) => (
                      <button
                        key={secs}
                        onClick={() => {
                          onSetInterval(secs);
                          setIsMenuOpen(false);
                        }}
                        className={`py-1 text-scale-12 rounded font-medium transition-colors ${
                          intervalSeconds === secs
                            ? 'bg-[var(--cobalt)] text-white'
                            : 'bg-[var(--surface-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {secs}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export Options */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onOpenExport();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-scale-13 text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Download className="w-4 h-4 text-[var(--ink-3)]" />
                  <span>Export meeting report</span>
                </button>

                {/* Copy Summary */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onCopySummary();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-scale-13 text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Copy className="w-4 h-4 text-[var(--ink-3)]" />
                  <span>Copy summary text</span>
                </button>

                {/* Theme Toggle */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onToggleDarkMode();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-scale-13 text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors border-t border-[var(--line)]"
                >
                  <div className="flex items-center gap-2.5">
                    {isDarkMode ? (
                      <Sun className="w-4 h-4 text-[var(--amber)]" />
                    ) : (
                      <Moon className="w-4 h-4 text-[var(--ink-3)]" />
                    )}
                    <span>Theme</span>
                  </div>
                  <span className="text-scale-12 text-[var(--ink-3)]">
                    {isDarkMode ? 'Dark' : 'Light'}
                  </span>
                </button>

                {/* Debug Logs Toggle */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onToggleDebugMode();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-scale-13 text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Bug className="w-4 h-4 text-[var(--ink-3)]" />
                    <span>Debug logs</span>
                  </div>
                  <span className="text-scale-12 text-[var(--ink-3)] font-mono">
                    {isDebugMode ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Keyboard Shortcuts */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onOpenShortcuts();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-scale-13 text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Command className="w-4 h-4 text-[var(--ink-3)]" />
                    <span>Keyboard shortcuts</span>
                  </div>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[11px] font-mono text-[var(--ink-3)]">
                    ?
                  </kbd>
                </button>

                {/* Destructive Actions */}
                <div className="pt-1 mt-1 border-t border-[var(--line)]">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onClearSession();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-scale-13 text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-[var(--ink-3)]" />
                    <span>Clear current session</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDeleteAllData();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-scale-13 text-[var(--live)] hover:bg-[var(--live)]/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete all stored data</span>
                  </button>
                </div>

                {/* Footer Attribution */}
                <div className="px-3 pt-2 pb-1 text-center border-t border-[var(--line)]">
                  <span className="text-[11px] text-[var(--ink-3)]">Powered by Gemini</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
