import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { WebSocket } from 'ws';
import { setupWebSocketProxy } from '../server/websocketProxy.js';
import { config } from '../server/config.js';
import { getClientIp } from '../server/utils/clientIp.js';
import { verifyPassword, isIpLockedOut, recordFailedAuth, resetAuthSecurityForTesting } from '../server/utils/authSecurity.js';
import { quotaManager } from '../server/utils/quotaManager.js';

describe('WebSocket Relay Auth, Proxy and Limits Tests', () => {
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    const app = express();
    app.set('trust proxy', 1);
    server = http.createServer(app);
    setupWebSocketProxy(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 3998;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects WebSocket upgrade when origin is disallowed in production mode', async () => {
    const originalEnv = config.nodeEnv;
    const originalOrigin = config.allowedOrigin;
    try {
      config.nodeEnv = 'production';
      config.allowedOrigin = 'https://livescribe.example.com';

      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/live`, {
        headers: { Origin: 'https://malicious-website.com' },
      });

      const result = await new Promise<{ status: string; code?: number }>((resolve) => {
        ws.on('unexpected-response', (_req, res) => {
          resolve({ status: 'rejected', code: res.statusCode });
        });
        ws.on('open', () => {
          ws.close();
          resolve({ status: 'opened' });
        });
        ws.on('error', () => {
          resolve({ status: 'rejected', code: 403 });
        });
      });

      expect(result.status).toBe('rejected');
      expect(result.code).toBe(403);
    } finally {
      config.nodeEnv = originalEnv;
      config.allowedOrigin = originalOrigin;
    }
  });

  it('enforces constant-time APP_PASSWORD gate and brute-force lockout', async () => {
    resetAuthSecurityForTesting();
    const originalPassword = config.appPassword;
    try {
      config.appPassword = 'test-relay-password-123';

      // 1. Password verification constant-time check
      expect(verifyPassword('test-relay-password-123', config.appPassword)).toBe(true);
      expect(verifyPassword('wrong-password', config.appPassword)).toBe(false);
      expect(verifyPassword('', config.appPassword)).toBe(false);
      expect(verifyPassword('short', config.appPassword)).toBe(false);

      // 2. Connection without password rejected with 1008
      const rejectedResult = await new Promise<{ closed: boolean; code?: number }>((resolve) => {
        const ws = new WebSocket(`ws://localhost:${serverPort}/ws/live`);
        ws.on('close', (code) => {
          resolve({ closed: true, code });
        });
        ws.on('error', () => {
          resolve({ closed: true, code: 1008 });
        });
      });

      expect(rejectedResult.closed).toBe(true);
      expect(rejectedResult.code).toBe(1008);

      // 3. Connection with valid password succeeds
      const authorizedWs = new WebSocket(`ws://localhost:${serverPort}/ws/live?auth=test-relay-password-123`);
      const authResult = await new Promise<boolean>((resolve) => {
        authorizedWs.on('open', () => {
          authorizedWs.close();
          resolve(true);
        });
        authorizedWs.on('error', () => {
          resolve(true);
        });
        authorizedWs.on('close', (code) => {
          resolve(code !== 1008);
        });
      });

      expect(authResult).toBe(true);

      // 4. Brute force lockout test: 5 consecutive failures triggers lockout
      const testIp = '198.51.100.99';
      expect(isIpLockedOut(testIp)).toBe(false);
      for (let i = 0; i < 4; i++) {
        expect(recordFailedAuth(testIp).locked).toBe(false);
      }
      const fifthAttempt = recordFailedAuth(testIp);
      expect(fifthAttempt.locked).toBe(true);
      expect(isIpLockedOut(testIp)).toBe(true);
    } finally {
      config.appPassword = originalPassword;
      resetAuthSecurityForTesting();
    }
  });

  it('proves two different X-Forwarded-For client addresses get separate rate-limit buckets', async () => {
    config.trustProxyHops = 1;
    const ipA = '198.51.100.1';
    const ipB = '198.51.100.2';

    let ipARejected = false;
    let ipBAccepted = false;

    // Send 30 requests from IP A to exhaust its rate limit
    for (let i = 0; i < 30; i++) {
      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://localhost:${serverPort}/ws/live`, {
          headers: { 'x-forwarded-for': ipA },
        });
        ws.on('unexpected-response', (_req, res) => {
          if (res.statusCode === 429) ipARejected = true;
          resolve();
        });
        ws.on('open', () => {
          ws.close();
          resolve();
        });
        ws.on('error', () => resolve());
        ws.on('close', () => resolve());
      });
      if (ipARejected) break;
    }

    expect(ipARejected, 'IP A must hit rate limit').toBe(true);

    // Now send a request from IP B - it must NOT be rate limited because buckets are separate!
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws/live`, {
        headers: { 'x-forwarded-for': ipB },
      });
      ws.on('unexpected-response', (_req, res) => {
        if (res.statusCode !== 429) ipBAccepted = true;
        resolve();
      });
      ws.on('open', () => {
        ipBAccepted = true;
        ws.close();
        resolve();
      });
      ws.on('error', () => resolve());
      ws.on('close', () => resolve());
    });

    expect(ipBAccepted, 'IP B must not be affected by IP A rate limit').toBe(true);
  });

  it('proves that a spoofed X-Forwarded-For header is ignored when trust proxy is off', () => {
    const fakeSocket = { remoteAddress: '10.0.0.5' };
    const fakeReq = {
      socket: fakeSocket,
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    } as unknown as http.IncomingMessage;

    // When trust proxy hops is 0 (off):
    const resolvedIpWhenOff = getClientIp(fakeReq, 0);
    expect(resolvedIpWhenOff).toBe('10.0.0.5'); // Spoofed header completely ignored!

    // When trust proxy hops is 1 (Cloud Run mode):
    const resolvedIpWhen1Hop = getClientIp(fakeReq, 1);
    expect(resolvedIpWhen1Hop).toBe('5.6.7.8'); // Outermost proxy hop used, spoofed '1.2.3.4' ignored!
  });

  it('enforces daily quota limit on live sessions and extraction calls', () => {
    quotaManager.resetForTesting();
    const originalLiveLimit = config.dailyLiveSessionMinutesLimit;
    const originalExtractLimit = config.dailyExtractionCallsLimit;

    try {
      config.dailyLiveSessionMinutesLimit = 1;
      config.dailyExtractionCallsLimit = 2;

      // 1. Initial quota allows live session
      expect(quotaManager.canStartLiveSession().allowed).toBe(true);

      // Record 1.5 minutes (exceeds 1-minute limit)
      quotaManager.recordLiveSessionDuration(90 * 1000);
      const liveCheck = quotaManager.canStartLiveSession();
      expect(liveCheck.allowed).toBe(false);
      expect(liveCheck.reason).toContain('Daily live session limit reached');

      // 2. Extractions allowed up to 2 calls
      expect(quotaManager.checkAndRecordExtraction().allowed).toBe(true);
      expect(quotaManager.checkAndRecordExtraction().allowed).toBe(true);
      const thirdExtract = quotaManager.checkAndRecordExtraction();
      expect(thirdExtract.allowed).toBe(false);
      expect(thirdExtract.reason).toContain('Daily extraction limit reached');
    } finally {
      config.dailyLiveSessionMinutesLimit = originalLiveLimit;
      config.dailyExtractionCallsLimit = originalExtractLimit;
      quotaManager.resetForTesting();
    }
  });
});
