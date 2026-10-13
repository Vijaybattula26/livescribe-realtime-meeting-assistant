import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { WebSocket } from 'ws';
import crypto from 'crypto';
import { apiRouter } from '../server/routes.js';
import { setupWebSocketProxy } from '../server/websocketProxy.js';
import { config } from '../server/config.js';

describe('Security: Secret Leak Prevention Tests', () => {
  let server: http.Server;
  let serverPort: number;

  const realApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
  const apiKeyHash = realApiKey
    ? crypto.createHash('sha256').update(realApiKey).digest('hex')
    : '';

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '500kb' }));
    app.use(apiRouter);

    server = http.createServer(app);
    setupWebSocketProxy(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 3999;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function assertNoSecretLeaked(content: string, contextDescription: string) {
    if (realApiKey && realApiKey.length >= 8) {
      expect(
        content.includes(realApiKey),
        `SECURITY VIOLATION: Real API key found in ${contextDescription}`
      ).toBe(false);

      if (apiKeyHash) {
        expect(
          content.includes(apiKeyHash),
          `SECURITY VIOLATION: API key SHA-256 hash found in ${contextDescription}`
        ).toBe(false);
      }
    }

    // Google API key patterns: AIza... or AQ....
    const aizaPattern = /\bAIza[0-9A-Za-z-_]{35}\b/g;
    const aqPattern = /\bAQ\.[0-9A-Za-z-_]{30,}\b/g;

    expect(aizaPattern.test(content)).toBe(false);
    expect(aqPattern.test(content)).toBe(false);
  }

  it('/healthz endpoint contains no secret material', async () => {
    const res = await fetch(`http://localhost:${serverPort}/healthz`);
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    assertNoSecretLeaked(bodyText, 'GET /healthz response');
  });

  it('/api/live-token endpoint contains no real API key', async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/live-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    assertNoSecretLeaked(bodyText, 'POST /api/live-token response');

    const json = JSON.parse(bodyText);
    expect(json.mode).toBe('relay');
    expect(json.url).toBe('/ws/live');
    expect(json.token).toBeDefined();
    // Verify token is a session identifier, not the Google key
    expect(json.token.startsWith('relay-')).toBe(true);
  });

  it('/api/extract endpoint response contains no secret material', async () => {
    const payload = {
      newTranscript: 'Ravi will send the revenue report by Friday.',
      currentSummary: '',
      currentDecisions: [],
      currentActionItems: [],
      currentOpenQuestions: [],
    };

    const res = await fetch(`http://localhost:${serverPort}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const bodyText = await res.text();
    assertNoSecretLeaked(bodyText, 'POST /api/extract response');
  }, 25000);

  it('WebSocket /ws/live relay protocol frames contain no secret material', async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/live`, {
        headers: { Origin: 'http://localhost:5173' },
      });

      const messages: string[] = [];

      const timer = setTimeout(() => {
        ws.close();
        // Verify all captured frames
        for (const msg of messages) {
          assertNoSecretLeaked(msg, 'WebSocket message frame');
        }
        resolve();
      }, 2000);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: 'models/gemini-3.1-flash-live-preview',
              generationConfig: { responseModalities: ['AUDIO'] },
            },
          })
        );
      });

      ws.on('message', (data) => {
        messages.push(data.toString());
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  });
});
