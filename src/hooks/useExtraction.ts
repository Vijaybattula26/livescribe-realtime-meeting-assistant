import { useState, useRef, useEffect, useCallback } from 'react';
import { TranscriptSegment, ExtractionState, ActionItem, TaskStatus } from '../types';
import { mergeActionItems } from '../utils/mergeActionItems';
import { saveSessionState, loadSessionState } from '../utils/storage';

export interface UseExtractionProps {
  segments: TranscriptSegment[];
  isLive: boolean;
  knownTerms?: string[];
}

export interface UseExtractionReturn {
  extractionState: ExtractionState;
  isExtracting: boolean;
  intervalSeconds: number;
  newWordsCount: number;
  toast: { message: string; type: 'info' | 'error' | 'success' } | null;
  setIntervalSeconds: (secs: number) => void;
  triggerExtraction: (force?: boolean) => Promise<void>;
  updateActionItem: (item: ActionItem) => void;
  deleteActionItem: (id: string) => void;
  addActionItem: (item: Omit<ActionItem, 'id'>) => void;
  toggleActionItemDone: (id: string) => void;
  dismissToast: () => void;
}

const MIN_WORDS_THRESHOLD = 40;

export function useExtraction({ segments, isLive, knownTerms = [] }: UseExtractionProps): UseExtractionReturn {
  const [extractionState, setExtractionState] = useState<ExtractionState>({
    summary: '',
    decisions: [],
    actionItems: [],
    openQuestions: [],
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [lastExtractedIndex, setLastExtractedIndex] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(
    null
  );

  const retryTimeoutRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  // Load existing persisted session on mount
  useEffect(() => {
    let mounted = true;
    loadSessionState().then((saved) => {
      if (mounted && saved) {
        setExtractionState(saved);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Compute new words arrived since last extraction
  const newTranscriptText = segments
    .slice(lastExtractedIndex)
    .map((s) => s.text)
    .join(' ');
  const newWordsCount = newTranscriptText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const showToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const triggerExtraction = useCallback(
    async (force = false): Promise<void> => {
      if (isExtracting) return;

      const unextractedSegments = segments.slice(lastExtractedIndex);
      const textToExtract = unextractedSegments.map((s) => s.text).join(' ').trim();
      const wordCount = textToExtract.split(/\s+/).filter(Boolean).length;

      // Skip extraction if fewer than 40 words unless forced by "Extract now" button
      if (!force && wordCount < MIN_WORDS_THRESHOLD) {
        return;
      }

      if (!textToExtract) {
        if (force) {
          showToast('No new transcript text available to extract.', 'info');
        }
        return;
      }

      setIsExtracting(true);

      try {
        const userTimezone =
          Intl && Intl.DateTimeFormat
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : 'UTC';

        const payload = {
          newTranscript: textToExtract,
          currentSummary: extractionState.summary,
          currentDecisions: extractionState.decisions,
          currentActionItems: extractionState.actionItems,
          currentOpenQuestions: extractionState.openQuestions,
          knownTerms,
          userTimezone,
          referenceDate: new Date().toISOString(),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = (await response.json().catch(() => ({}))) as {
            error?: string;
            dailyLimitReached?: boolean;
          };
          if (errData.dailyLimitReached || response.status === 429) {
            showToast(
              errData.error || 'Daily extraction limit reached. Please try again tomorrow.',
              'error'
            );
            return;
          }
          throw new Error(errData.error || `Extraction failed with HTTP ${response.status}`);
        }

        const data = (await response.json()) as ExtractionState;

        // Merge incoming action items with existing, strictly preserving manual edits
        const mergedActionItems = mergeActionItems(
          extractionState.actionItems,
          data.actionItems || []
        );

        const updatedState: ExtractionState = {
          summary: data.summary || extractionState.summary,
          decisions: data.decisions || extractionState.decisions,
          actionItems: mergedActionItems,
          openQuestions: data.openQuestions || extractionState.openQuestions,
        };

        setExtractionState(updatedState);
        setLastExtractedIndex(segments.length);
        retryCountRef.current = 0;

        // Persist to IndexedDB
        saveSessionState(updatedState);

        if (force) {
          showToast('Meeting insights successfully updated.', 'success');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Extraction error';
        console.error('[Extraction] Error during extraction:', err);
        showToast(`Extraction failed: ${msg}. Retrying automatically...`, 'error');

        // Exponential backoff retry (up to 3 retries)
        if (retryCountRef.current < 3) {
          retryCountRef.current++;
          const retryDelay = Math.min(2000 * Math.pow(2, retryCountRef.current), 15000);
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = window.setTimeout(() => {
            triggerExtraction(force);
          }, retryDelay);
        }
      } finally {
        setIsExtracting(false);
      }
    },
    [isExtracting, segments, lastExtractedIndex, extractionState, showToast]
  );

  // Periodic extraction timer
  useEffect(() => {
    if (!isLive) {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      return;
    }

    intervalTimerRef.current = window.setInterval(() => {
      triggerExtraction(false);
    }, intervalSeconds * 1000);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [isLive, intervalSeconds, triggerExtraction]);

  // Manual actions
  const updateActionItem = useCallback(
    (item: ActionItem) => {
      const updatedItem = { ...item, isManual: true };
      setExtractionState((prev) => {
        const nextItems = prev.actionItems.map((ai) => (ai.id === item.id ? updatedItem : ai));
        const nextState = { ...prev, actionItems: nextItems };
        saveSessionState(nextState);
        return nextState;
      });
      showToast('Action item updated.', 'info');
    },
    [showToast]
  );

  const deleteActionItem = useCallback(
    (id: string) => {
      setExtractionState((prev) => {
        const nextItems = prev.actionItems.filter((ai) => ai.id !== id);
        const nextState = { ...prev, actionItems: nextItems };
        saveSessionState(nextState);
        return nextState;
      });
      showToast('Action item removed.', 'info');
    },
    [showToast]
  );

  const addActionItem = useCallback(
    (item: Omit<ActionItem, 'id'>) => {
      const newItem: ActionItem = {
        ...item,
        id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        isManual: true,
      };
      setExtractionState((prev) => {
        const nextState = { ...prev, actionItems: [newItem, ...prev.actionItems] };
        saveSessionState(nextState);
        return nextState;
      });
      showToast('New action item added.', 'success');
    },
    [showToast]
  );

  const toggleActionItemDone = useCallback((id: string) => {
    setExtractionState((prev) => {
      const nextItems: ActionItem[] = prev.actionItems.map((ai) =>
        ai.id === id ? { ...ai, status: (ai.status === 'done' ? 'open' : 'done') as TaskStatus } : ai
      );
      const nextState: ExtractionState = { ...prev, actionItems: nextItems };
      saveSessionState(nextState);
      return nextState;
    });
  }, []);

  return {
    extractionState,
    isExtracting,
    intervalSeconds,
    newWordsCount,
    toast,
    setIntervalSeconds,
    triggerExtraction,
    updateActionItem,
    deleteActionItem,
    addActionItem,
    toggleActionItemDone,
    dismissToast,
  };
}
