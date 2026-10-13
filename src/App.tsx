import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveRibbon } from './components/LiveRibbon';
import { TranscriptPanel } from './components/TranscriptPanel';
import { DashboardPanel } from './components/DashboardPanel';
import { ActionItemModal } from './components/ActionItemModal';
import { ExportModal } from './components/ExportModal';
import { ConsentBanner } from './components/ConsentBanner';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { Toast } from './components/Toast';
import { useLiveSession } from './hooks/useLiveSession';
import { useExtraction } from './hooks/useExtraction';
import { ActionItem } from './types';
import { getUserConsent, setUserConsent, loadKnownTerms, saveKnownTerms } from './utils/storage';
import { Play, Pause, Square } from 'lucide-react';

export const App: React.FC = () => {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('livescribe_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Known names and terms state (persisted to IndexedDB)
  const [knownTerms, setKnownTerms] = useState<string[]>([]);
  const [termsInput, setTermsInput] = useState<string>('');

  // Debug logging flag state
  const [isDebugMode, setIsDebugMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('livescribe_debug') === 'true';
    }
    return false;
  });

  // Mobile active tab ('transcript' | 'notes')
  const [mobileTab, setMobileTab] = useState<'transcript' | 'notes'>('transcript');

  // Search input ref for keyboard shortcut focus
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Modals state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [modalActionItem, setModalActionItem] = useState<ActionItem | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  // App-level toast state (merges with extraction toasts)
  const [appToast, setAppToast] = useState<{
    message: string;
    type: 'info' | 'error' | 'success';
  } | null>(null);

  // Load persisted known terms on mount
  useEffect(() => {
    loadKnownTerms().then((terms) => {
      if (terms && terms.length > 0) {
        setKnownTerms(terms);
        setTermsInput(terms.join(', '));
      }
    });
  }, []);

  const handleTermsChange = (newVal: string) => {
    setTermsInput(newVal);
    const parsed = newVal
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    setKnownTerms(parsed);
    saveKnownTerms(parsed);
  };

  const handleToggleDebug = () => {
    const next = !isDebugMode;
    setIsDebugMode(next);
    localStorage.setItem('livescribe_debug', next ? 'true' : 'false');
  };

  // Apply dark mode class to HTML tag
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('livescribe_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('livescribe_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Live Speech & Audio Session Hook
  const {
    status,
    segments,
    interimText,
    micLevel,
    sessionDuration,
    latencyMs,
    errorMessage,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    clearSession,
  } = useLiveSession(knownTerms);

  // Meeting Extraction Engine Hook
  const {
    extractionState,
    isExtracting,
    intervalSeconds,
    newWordsCount,
    toast: extractionToast,
    setIntervalSeconds,
    triggerExtraction,
    updateActionItem,
    deleteActionItem,
    addActionItem,
    toggleActionItemDone,
    dismissToast: dismissExtractionToast,
  } = useExtraction({
    segments,
    isLive: status === 'live',
    knownTerms,
  });

  // Unified toast
  const activeToast = appToast || extractionToast;
  const handleDismissToast = () => {
    setAppToast(null);
    dismissExtractionToast();
  };

  // Session control with required verb toasts
  const handleStartSession = useCallback(async () => {
    const consented = getUserConsent();
    if (!consented) {
      setIsConsentOpen(true);
      return;
    }
    await startSession();
    setAppToast({ message: 'Listening started', type: 'info' });
  }, [startSession]);

  const handlePauseSession = useCallback(() => {
    pauseSession();
    setAppToast({ message: 'Paused', type: 'info' });
  }, [pauseSession]);

  const handleResumeSession = useCallback(async () => {
    await resumeSession();
    setAppToast({ message: 'Listening started', type: 'info' });
  }, [resumeSession]);

  const handleStopSession = useCallback(() => {
    stopSession();
    setAppToast({ message: 'Stopped', type: 'info' });
  }, [stopSession]);

  const handleAcceptConsent = async () => {
    setUserConsent(true);
    setIsConsentOpen(false);
    await startSession();
    setAppToast({ message: 'Listening started', type: 'info' });
  };

  // Copy summary handler
  const handleCopySummary = () => {
    if (!extractionState.summary.trim()) {
      setAppToast({ message: 'No summary generated yet', type: 'info' });
      return;
    }
    navigator.clipboard.writeText(extractionState.summary);
    setAppToast({ message: 'Summary copied to clipboard', type: 'success' });
  };

  // Clear session confirmation
  const handleConfirmClearSession = async () => {
    await clearSession();
    setIsClearConfirmOpen(false);
    setAppToast({ message: 'Session cleared', type: 'info' });
  };

  // Delete all data confirmation
  const handleConfirmDeleteAll = async () => {
    await clearSession();
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase('livescribe_db');
    }
    localStorage.removeItem('livescribe_terms');
    setIsDeleteConfirmOpen(false);
    window.location.reload();
  };

  // Action item modal helpers
  const handleEditActionItem = (item: ActionItem) => {
    setModalActionItem(item);
    setIsActionModalOpen(true);
  };

  const handleAddNewActionItem = () => {
    setModalActionItem(null);
    setIsActionModalOpen(true);
  };

  const handleSaveActionItemModal = (item: Omit<ActionItem, 'id'> | ActionItem) => {
    if ('id' in item && item.id) {
      updateActionItem(item as ActionItem);
    } else {
      addActionItem(item);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      // Space = start / pause / resume (when no input is focused)
      if (e.key === ' ' && !isInput) {
        e.preventDefault();
        if (status === 'idle') {
          handleStartSession();
        } else if (status === 'live') {
          handlePauseSession();
        } else if (status === 'paused') {
          handleResumeSession();
        }
        return;
      }

      // E = Extract now
      if ((e.key === 'e' || e.key === 'E') && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        triggerExtraction(true);
        return;
      }

      // / = focus search in transcript
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
        return;
      }

      // ? = open keyboard shortcuts dialog
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }

      // Escape = close dialogs
      if (e.key === 'Escape') {
        setIsExportOpen(false);
        setIsConsentOpen(false);
        setIsShortcutsOpen(false);
        setIsClearConfirmOpen(false);
        setIsDeleteConfirmOpen(false);
        setIsActionModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    status,
    handleStartSession,
    handlePauseSession,
    handleResumeSession,
    triggerExtraction,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)] text-[var(--ink)] transition-colors antialiased">
      {/* Sticky Top Navigation Bar */}
      <Header
        status={status}
        sessionDuration={sessionDuration}
        latencyMs={latencyMs}
        intervalSeconds={intervalSeconds}
        isDarkMode={isDarkMode}
        isDebugMode={isDebugMode}
        onToggleDarkMode={toggleDarkMode}
        onToggleDebugMode={handleToggleDebug}
        onStart={handleStartSession}
        onStop={handleStopSession}
        onPause={handlePauseSession}
        onResume={handleResumeSession}
        onClearSession={() => setIsClearConfirmOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onCopySummary={handleCopySummary}
        onSetInterval={setIntervalSeconds}
        onDeleteAllData={() => setIsDeleteConfirmOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Signature Element: Full-width Live Audio Ribbon */}
      <LiveRibbon status={status} micLevel={micLevel} />

      {/* Connection / Audio Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="bg-[var(--live)]/10 border-b border-[var(--live)]/20 px-4 py-2.5 text-center text-scale-13 font-medium text-[var(--live)] flex items-center justify-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--live)] inline-block animate-pulse" />
          <span>Connection or audio issue: {errorMessage}</span>
        </div>
      )}

      {/* Mobile Tab Switcher (<700px) */}
      <div className="min-[700px]:hidden px-4 pt-3 pb-1 border-b border-[var(--line)] bg-[var(--surface)]">
        <div
          role="tablist"
          aria-label="View selection"
          className="grid grid-cols-2 p-1 bg-[var(--surface-2)] rounded-control gap-1"
        >
          <button
            role="tab"
            aria-selected={mobileTab === 'transcript'}
            aria-controls="mobile-transcript-panel"
            id="mobile-tab-transcript"
            onClick={() => setMobileTab('transcript')}
            className={`py-2 text-scale-13 font-medium rounded-control transition-all min-h-[44px] flex items-center justify-center ${
              mobileTab === 'transcript'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            Transcript ({segments.length})
          </button>
          <button
            role="tab"
            aria-selected={mobileTab === 'notes'}
            aria-controls="mobile-notes-panel"
            id="mobile-tab-notes"
            onClick={() => setMobileTab('notes')}
            className={`py-2 text-scale-13 font-medium rounded-control transition-all min-h-[44px] flex items-center justify-center ${
              mobileTab === 'notes'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            Notes ({extractionState.actionItems.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 pb-24 min-[700px]:pb-6 flex flex-col min-h-0">
        {/* Desktop (>=1100px): Two columns (1.05fr / 0.95fr) */}
        {/* Tablet (700px-1099px): Vertically stacked columns */}
        {/* Mobile (<700px): Tab-switched single column */}
        <div className="flex-1 min-h-0 min-[1100px]:grid min-[1100px]:grid-cols-[1.05fr_0.95fr] gap-6 flex flex-col">
          {/* Transcript Panel */}
          <section
            id="mobile-transcript-panel"
            aria-labelledby="mobile-tab-transcript"
            className={`min-h-0 flex flex-col h-[600px] min-[1100px]:h-[calc(100vh-175px)] ${
              mobileTab === 'transcript' ? 'flex' : 'hidden min-[700px]:flex'
            }`}
          >
            <TranscriptPanel
              segments={segments}
              interimText={interimText}
              isLive={status === 'live'}
              knownTerms={knownTerms}
              termsInput={termsInput}
              onTermsChange={handleTermsChange}
              searchInputRef={searchInputRef}
            />
          </section>

          {/* Notes Panel */}
          <section
            id="mobile-notes-panel"
            aria-labelledby="mobile-tab-notes"
            className={`min-h-0 flex flex-col h-[600px] min-[1100px]:h-[calc(100vh-175px)] ${
              mobileTab === 'notes' ? 'flex' : 'hidden min-[700px]:flex'
            }`}
          >
            <DashboardPanel
              state={extractionState}
              isExtracting={isExtracting}
              newWordsCount={newWordsCount}
              onExtractNow={() => triggerExtraction(true)}
              onToggleDone={toggleActionItemDone}
              onEditItem={handleEditActionItem}
              onDeleteItem={deleteActionItem}
              onAddItem={handleAddNewActionItem}
            />
          </section>
        </div>
      </main>

      {/* Mobile Fixed Bottom Control Bar (<700px) */}
      <aside
        aria-label="Mobile audio controls"
        className="min-[700px]:hidden fixed bottom-0 left-0 right-0 p-3 bg-[var(--surface)] border-t border-[var(--line)] shadow-calm z-40 flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              status === 'live'
                ? 'bg-[var(--live)] animate-pulse'
                : status === 'paused'
                ? 'bg-[var(--amber)]'
                : 'bg-[var(--ink-3)]'
            }`}
          />
          <span className="font-mono text-scale-13 font-semibold text-[var(--ink)]">
            {sessionDuration}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <button
              onClick={handleStartSession}
              className="min-h-[44px] px-5 rounded-control bg-[var(--cobalt)] text-white text-scale-13 font-medium flex items-center gap-2 active:brightness-95 transition-all shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start listening</span>
            </button>
          )}

          {status === 'live' && (
            <>
              <button
                onClick={handlePauseSession}
                className="min-h-[44px] px-4 rounded-control bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] text-scale-13 font-medium flex items-center gap-1.5 active:bg-[var(--surface)]"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
              <button
                onClick={handleStopSession}
                className="min-h-[44px] px-4 rounded-control bg-[var(--live)] text-white text-scale-13 font-medium flex items-center gap-1.5 active:brightness-95 shadow-sm"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop</span>
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={handleResumeSession}
                className="min-h-[44px] px-4 rounded-control bg-[var(--cobalt)] text-white text-scale-13 font-medium flex items-center gap-1.5 active:brightness-95 shadow-sm"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Resume</span>
              </button>
              <button
                onClick={handleStopSession}
                className="min-h-[44px] px-4 rounded-control bg-[var(--live)] text-white text-scale-13 font-medium flex items-center gap-1.5 active:brightness-95 shadow-sm"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Modals & Dialogs */}
      <ActionItemModal
        isOpen={isActionModalOpen}
        item={modalActionItem}
        onClose={() => setIsActionModalOpen(false)}
        onSave={handleSaveActionItemModal}
      />

      <ExportModal
        isOpen={isExportOpen}
        segments={segments}
        state={extractionState}
        sessionDuration={sessionDuration}
        onClose={() => setIsExportOpen(false)}
      />

      <ConsentBanner isOpen={isConsentOpen} onAccept={handleAcceptConsent} />

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* Confirmation Dialogs for Destructive Actions */}
      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="Clear current session?"
        description="This will remove all transcript turns and extracted notes from the current meeting session. Any unsaved notes will be lost."
        confirmLabel="Clear session"
        onConfirm={handleConfirmClearSession}
        onCancel={() => setIsClearConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Delete all stored data?"
        description="This will permanently delete all transcripts, action items, meeting summaries, and saved names from local browser storage (IndexedDB). This action cannot be undone."
        confirmLabel="Delete everything"
        isDestructive={true}
        onConfirm={handleConfirmDeleteAll}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />

      {/* Toast Notification Container */}
      <Toast toast={activeToast} onDismiss={handleDismissToast} />
    </div>
  );
};
