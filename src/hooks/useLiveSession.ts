import { useState, useRef, useCallback, useEffect } from 'react';
import { TranscriptSegment, LiveConnectionStatus } from '../types';
import { useAudioCapture } from './useAudioCapture';
import { GeminiLiveClient } from '../services/geminiLiveClient';
import { saveTranscriptSegment, loadTranscriptSegments, clearAllStoredData } from '../utils/storage';

export interface UseLiveSessionReturn {
  status: LiveConnectionStatus;
  segments: TranscriptSegment[];
  interimText: string;
  micLevel: number;
  sessionDuration: string;
  latencyMs: number | null;
  errorMessage: string | null;
  startSession: () => Promise<void>;
  stopSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  clearSession: () => Promise<void>;
}

export function useLiveSession(knownTerms: string[] = []): UseLiveSessionReturn {
  const [status, setStatus] = useState<LiveConnectionStatus>('idle');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const timerRef = useRef<number | null>(null);
  const knownTermsRef = useRef<string[]>(knownTerms);
  const audioCapture = useAudioCapture();

  useEffect(() => {
    knownTermsRef.current = knownTerms;
  }, [knownTerms]);

  // Load existing persisted transcript on initial mount
  useEffect(() => {
    let mounted = true;
    loadTranscriptSegments().then((saved) => {
      if (mounted && saved && saved.length > 0) {
        setSegments(saved);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Handle online/offline browser network events
  useEffect(() => {
    const handleOnline = () => {
      if (status === 'offline') {
        setStatus('reconnecting');
      }
    };
    const handleOffline = () => {
      setStatus('offline');
      setErrorMessage('Internet connection lost.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status]);

  // Session timer
  useEffect(() => {
    if (status === 'live') {
      timerRef.current = window.setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const handleTranscriptChunk = useCallback(
    ({ text, isFinal, latencyMs: measuredLatency }: { text: string; isFinal: boolean; latencyMs?: number }) => {
      if (measuredLatency) {
        setLatencyMs(measuredLatency);
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      if (!isFinal) {
        // Update speculative/interim text
        setInterimText(trimmed);
      } else {
        // Finalized text segment
        setInterimText('');
        const timestamp = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const newSegment: TranscriptSegment = {
          id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          startedAt: timestamp,
          text: trimmed,
          isFinal: true,
        };

        setSegments((prev) => {
          const updated = [...prev, newSegment];
          return updated;
        });

        // Persist to IndexedDB
        saveTranscriptSegment(newSegment);
      }
    },
    []
  );

  const startSession = useCallback(async () => {
    setErrorMessage(null);

    try {
      // 1. Initialize Gemini Live client with speech context known terms
      const client = new GeminiLiveClient(
        {
          onStatusChange: (newStatus) => {
            setStatus(newStatus);
          },
          onTranscript: handleTranscriptChunk,
          onError: (err) => {
            setErrorMessage(err);
            setStatus('error');
          },
        },
        knownTermsRef.current
      );
      liveClientRef.current = client;

      // 2. Connect to Live API
      await client.connect();

      // 3. Start microphone capture
      const micStarted = await audioCapture.startCapture((pcmBuffer) => {
        client.sendAudioChunk(pcmBuffer);
      });

      if (!micStarted) {
        client.disconnect(true);
        setStatus('error');
        setErrorMessage(audioCapture.error || 'Failed to access microphone.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start live session';
      console.error('[LiveSession] Error in startSession:', err);
      setStatus('error');
      setErrorMessage(msg);
      if (liveClientRef.current) {
        liveClientRef.current.disconnect(true);
      }
    }
  }, [audioCapture, handleTranscriptChunk]);

  const stopSession = useCallback(() => {
    // Stop microphone first to release hardware
    audioCapture.stopCapture();

    // Disconnect Live WebSocket
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }

    setInterimText('');
    setStatus('idle');
  }, [audioCapture]);

  const pauseSession = useCallback(() => {
    audioCapture.pauseCapture();
    setStatus('paused');
  }, [audioCapture]);

  const resumeSession = useCallback(() => {
    audioCapture.resumeCapture();
    setStatus('live');
  }, [audioCapture]);

  const clearSession = useCallback(async () => {
    stopSession();
    setSegments([]);
    setInterimText('');
    setSessionSeconds(0);
    setLatencyMs(null);
    setErrorMessage(null);
    await clearAllStoredData();
  }, [stopSession]);

  // Format timer as HH:MM:SS
  const formatDuration = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return {
    status,
    segments,
    interimText,
    micLevel: audioCapture.micLevel,
    sessionDuration: formatDuration(sessionSeconds),
    latencyMs,
    errorMessage: errorMessage || audioCapture.error,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    clearSession,
  };
}
