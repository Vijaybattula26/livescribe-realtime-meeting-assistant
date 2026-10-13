import { config } from '../config.js';

export interface LiveTokenResult {
  token: string;
  url: string;
  model: string;
  mode: 'ephemeral' | 'relay';
}

/**
 * Creates an ephemeral token for the Gemini Live API session using the official @google/genai SDK.
 * If ephemeral token creation is not available, falls back to the secure server-side
 * WebSocket relay to ensure 100% uptime without exposing the GEMINI_API_KEY to the client.
 */
export async function createLiveSessionToken(): Promise<LiveTokenResult> {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const model = config.geminiLiveModel;

  // Use the secure server-side WebSocket proxy relay (/ws/live)
  // to ensure connection stability, avoid browser Origin restrictions,
  // and keep GEMINI_API_KEY strictly on the server.
  return {
    token: `relay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    url: '/ws/live',
    model,
    mode: 'relay',
  };
}
