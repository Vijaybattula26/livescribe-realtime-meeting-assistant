import { useState, useRef, useCallback, useEffect } from 'react';
import { debugLog, debugError } from '../utils/logger';

export interface UseAudioCaptureReturn {
  isCapturing: boolean;
  isPaused: boolean;
  micLevel: number;
  error: string | null;
  startCapture: (onChunk: (pcmBuffer: ArrayBuffer) => void) => Promise<boolean>;
  stopCapture: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isPausedRef = useRef(false);

  // Listen to audio device changes
  useEffect(() => {
    const handleDeviceChange = async () => {
      debugLog('[DEBUG][AudioCapture] Audio devices changed.');
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, []);

  const stopCapture = useCallback(() => {
    // 1. Disconnect and cleanup AudioWorkletNode
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // 2. Disconnect source node
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // 3. Stop all microphone tracks to turn off hardware mic LED
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    // 4. Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }

    setIsCapturing(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setMicLevel(0);
  }, []);

  const pauseCapture = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    setMicLevel(0);
  }, []);

  const resumeCapture = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  const startCapture = useCallback(
    async (onChunk: (pcmBuffer: ArrayBuffer) => void): Promise<boolean> => {
      setError(null);
      stopCapture();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Your browser does not support microphone audio capture.');
        return false;
      }

      try {
        debugLog('[DEBUG] Requesting microphone permission...');
        // 1. Request microphone with echo cancellation and noise suppression
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        mediaStreamRef.current = stream;
        debugLog(
          `[DEBUG] Mic permission result: GRANTED (active tracks: ${stream.getAudioTracks().length})`
        );

        // 2. Create AudioContext (targeting standard audio pipeline)
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        // 3. Load AudioWorklet processor module
        debugLog('[DEBUG] Loading AudioWorklet module: /audio-processor.worklet.js');
        await audioCtx.audioWorklet.addModule('/audio-processor.worklet.js');
        debugLog(
          `[DEBUG] AudioWorklet loaded successfully (sampleRate: ${audioCtx.sampleRate}Hz, baseLatency: ${audioCtx.baseLatency ?? 'n/a'}s)`
        );

        // 4. Instantiate Worklet Node
        const workletNode = new AudioWorkletNode(audioCtx, 'livescribe-audio-processor');
        workletNodeRef.current = workletNode;
        debugLog('[DEBUG] AudioWorkletNode created and connected');

        // 5. Connect media stream source to worklet
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;
        sourceNode.connect(workletNode);

        // 6. Handle messages from AudioWorklet
        workletNode.port.onmessage = (event) => {
          if (isPausedRef.current) return;

          const data = event.data as {
            type: string;
            pcmData: ArrayBuffer;
            rms: number;
          };

          if (data.type === 'AUDIO_CHUNK') {
            // Smoothly update mic level (normalized 0 to 1 with non-linear scale)
            const normalizedLevel = Math.min(1, Math.max(0, data.rms * 5.0));
            setMicLevel(normalizedLevel);

            // Forward PCM buffer to callback
            onChunk(data.pcmData);
          }
        };

        setIsCapturing(true);
        setIsPaused(false);
        isPausedRef.current = false;
        return true;
      } catch (err: unknown) {
        let msg = 'Failed to access microphone.';
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = 'Microphone permission was denied. Please allow microphone access in browser settings.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'No microphone device was detected on your system.';
          } else if (err.name === 'NotReadableError') {
            msg = 'Microphone is already in use by another application or blocked.';
          }
        }
        debugError(`[DEBUG] Mic permission result: DENIED/FAILED - ${msg}`, err);
        setError(msg);
        stopCapture();
        return false;
      }
    },
    [stopCapture]
  );

  return {
    isCapturing,
    isPaused,
    micLevel,
    error,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
  };
}
