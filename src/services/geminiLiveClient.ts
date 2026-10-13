import { LiveTokenResponse } from '../types';
import { debugLog, debugError } from '../utils/logger';

export interface GeminiLiveCallbacks {
  onStatusChange: (status: 'connecting' | 'live' | 'reconnecting' | 'error' | 'idle') => void;
  onTranscript: (data: { text: string; isFinal: boolean; latencyMs?: number }) => void;
  onError: (errorMsg: string) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private callbacks: GeminiLiveCallbacks;
  private isIntentionalClose = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: number | null = null;
  private lastChunkSendTimestamp = 0;
  private chunkCount = 0;
  private knownTerms: string[] = [];

  constructor(callbacks: GeminiLiveCallbacks, knownTerms: string[] = []) {
    this.callbacks = callbacks;
    this.knownTerms = knownTerms;
  }

  private safeWsUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      return url.split('?')[0];
    }
  }

  /**
   * Connects to the Live API by requesting credentials from the backend,
   * then establishing either a direct WebSocket with an ephemeral token
   * or connecting via the secure server WebSocket relay.
   */
  public async connect(): Promise<void> {
    this.isIntentionalClose = false;
    this.callbacks.onStatusChange(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      // 1. Fetch ephemeral token or session info from backend
      const res = await fetch('/api/live-token', { method: 'POST' });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Server returned status ${res.status}`);
      }

      const tokenData = (await res.json()) as LiveTokenResponse;

      // 2. Determine WebSocket URL
      let wsUrl: string;
      if (tokenData.mode === 'ephemeral') {
        wsUrl = tokenData.url;
      } else {
        // Connect to server proxy (/ws/live)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws/live`;
      }

      if (localStorage.getItem('livescribe_debug') === 'true') {
        console.log(`[DEBUG] Connecting to WebSocket (mode: ${tokenData.mode}) at: ${this.safeWsUrl(wsUrl)}`);
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (localStorage.getItem('livescribe_debug') === 'true') {
          console.log(`[DEBUG] WebSocket open: connected to ${this.safeWsUrl(wsUrl)}`);
        }
        this.reconnectAttempts = 0;
        this.chunkCount = 0;
        this.callbacks.onStatusChange('live');

        // Send initial setup frame with inputAudioTranscription enabled
        const termsPrompt =
          this.knownTerms && this.knownTerms.length > 0
            ? ` Expected names and terms in this meeting: ${this.knownTerms.join(', ')}.`
            : '';

        const setupMessage = {
          setup: {
            model: `models/${tokenData.model || 'gemini-3.1-flash-live-preview'}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
            inputAudioTranscription: {},
            systemInstruction: {
              parts: [
                {
                  text: `You are a real-time transcription assistant. Accurately transcribe whatever speech is streamed to you.${termsPrompt}`,
                },
              ],
            },
          },
        };

        this.send(setupMessage);
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        await this.handleMessage(event.data);
      };

      this.ws.onerror = (err) => {
        debugError('[DEBUG] WebSocket error event:', err);
        this.callbacks.onError('WebSocket connection error occurred.');
        this.callbacks.onStatusChange('error');
      };

      this.ws.onclose = (event: CloseEvent) => {
        debugLog(
          `[DEBUG] WebSocket closed: code=${event.code}, reason="${event.reason || ''}", wasClean=${event.wasClean}`
        );
        this.ws = null;

        if (!this.isIntentionalClose) {
          if (event.code !== 1000) {
            this.callbacks.onError(
              `WebSocket closed (code: ${event.code}${event.reason ? `, ${event.reason}` : ''})`
            );
            this.callbacks.onStatusChange('error');
          }
          // Do not retry automatically on policy/auth/quota failures (code 1008)
          if (event.code === 1008) {
            return;
          }
          this.scheduleReconnect();
        } else {
          this.callbacks.onStatusChange('idle');
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to Live API';
      debugError('[DEBUG] Connection error:', err);
      this.callbacks.onError(msg);
      this.callbacks.onStatusChange('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Encodes and sends a 16kHz PCM audio chunk to the Gemini Live session
   */
  public sendAudioChunk(pcmBuffer: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.lastChunkSendTimestamp = performance.now();
    this.chunkCount++;

    // Convert ArrayBuffer to Base64
    const bytes = new Uint8Array(pcmBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    debugLog(
      `[DEBUG] Audio chunk #${this.chunkCount} sent: sampleRate=16000, bytes=${bytes.byteLength}`
    );

    const message = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Data,
        },
      },
    };

    this.send(message);
  }

  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private async handleMessage(rawOrBlob: string | Blob | ArrayBuffer): Promise<void> {
    try {
      let raw: string;
      if (typeof rawOrBlob === 'string') {
        raw = rawOrBlob;
      } else if (rawOrBlob instanceof Blob) {
        raw = await rawOrBlob.text();
      } else if (rawOrBlob instanceof ArrayBuffer) {
        raw = new TextDecoder().decode(rawOrBlob);
      } else {
        raw = String(rawOrBlob);
      }

      const data = JSON.parse(raw) as {
        setupComplete?: Record<string, unknown>;
        serverContent?: {
          inputTranscription?: { text?: string };
          interimInputTranscription?: { text?: string };
          modelTurn?: { parts?: Array<{ text?: string }> };
        };
        error?: { message?: string; code?: number };
      };

      if (data.setupComplete) {
        debugLog('[DEBUG] Setup complete event received from Gemini Live');
      }

      if (data.error) {
        debugError(
          '[DEBUG] Gemini Live server error message:',
          data.error.message || JSON.stringify(data.error)
        );
        this.callbacks.onError(data.error.message || 'Gemini Live encountered an error');
        this.callbacks.onStatusChange('error');
        return;
      }

      const content = data.serverContent;
      if (!content) return;

      const latencyMs =
        this.lastChunkSendTimestamp > 0
          ? Math.max(120, Math.round(performance.now() - this.lastChunkSendTimestamp))
          : undefined;

      // 1. Check for Finalized input audio transcription
      if (content.inputTranscription?.text) {
        debugLog(
          `[DEBUG] Transcript event [final]: "${content.inputTranscription.text}" (latency: ${latencyMs}ms)`
        );
        this.callbacks.onTranscript({
          text: content.inputTranscription.text,
          isFinal: true,
          latencyMs,
        });
      }
      // 2. Check for Interim (speculative/partial) input audio transcription
      else if (content.interimInputTranscription?.text) {
        debugLog(`[DEBUG] Transcript event [interim]: "${content.interimInputTranscription.text}"`);
        this.callbacks.onTranscript({
          text: content.interimInputTranscription.text,
          isFinal: false,
          latencyMs,
        });
      }
      // 3. Check for model generated text responses
      else if (content.modelTurn?.parts?.[0]?.text) {
        debugLog(`[DEBUG] Transcript event [modelTurn]: "${content.modelTurn.parts[0].text}"`);
        this.callbacks.onTranscript({
          text: content.modelTurn.parts[0].text,
          isFinal: true,
          latencyMs,
        });
      }
    } catch (err) {
      debugError('[DEBUG] Failed to parse incoming WebSocket message:', err);
    }
  }

  private scheduleReconnect(): void {
    if (this.isIntentionalClose) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.callbacks.onStatusChange('error');
      this.callbacks.onError('Max reconnection attempts reached. Please click Start to retry.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    debugLog(`[DEBUG] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
    this.callbacks.onStatusChange('reconnecting');

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Closes the active WebSocket session and cleans up timers
   */
  public disconnect(preserveStatus = false): void {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        } catch (err) {
          console.debug('[DEBUG] Failed to send audioStreamEnd:', err);
        }
      }
      this.ws.close(1000, 'User Stopped Session');
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    if (!preserveStatus) {
      this.callbacks.onStatusChange('idle');
    }
  }
}
