import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'http';
import { config } from './config.js';
import { debugLog, debugWarn, logError } from './utils/logger.js';
import { getClientIp } from './utils/clientIp.js';
import { verifyPassword, isIpLockedOut, recordFailedAuth, recordSuccessfulAuth } from './utils/authSecurity.js';
import { quotaManager } from './utils/quotaManager.js';

/**
 * Sets up a secure, hardened WebSocket bridge at /ws/live
 * Forwards bidirectional audio & transcription frames between the browser
 * and the Google Gemini Live API without exposing the server GEMINI_API_KEY.
 *
 * Hardening features:
 * 1. Proxy-aware real client IP extraction (supporting Cloud Run / reverse proxies).
 * 2. Origin verification (restricted to ALLOWED_ORIGIN in production).
 * 3. Per-IP connection rate limiting (max 25 attempts / min).
 * 4. Cap on concurrent active sessions (configurable via MAX_CONCURRENT_SESSIONS).
 * 5. Maximum session duration timer with clean close message.
 * 6. Daily quota limit on total live session minutes to protect API budgets.
 * 7. Constant-time APP_PASSWORD comparison with brute-force lockout protection.
 */
export function setupWebSocketProxy(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  // Rate limiting map: IP -> timestamp array
  const ipConnections = new Map<string, number[]>();
  let activeSessions = 0;

  const isOriginAllowed = (origin: string | undefined): boolean => {
    if (!origin) return true; // Direct node / test / non-browser connections

    const allowed = new Set([
      config.allowedOrigin.toLowerCase(),
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3099',
      'http://127.0.0.1:3099',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ]);

    try {
      const parsedOrigin = new URL(origin).origin.toLowerCase();
      if (allowed.has(parsedOrigin)) return true;
      if (config.nodeEnv === 'development') return true;
      return false;
    } catch {
      return false;
    }
  };

  const checkIpRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxPerMinute = 25;

    let timestamps = ipConnections.get(ip) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= maxPerMinute) {
      ipConnections.set(ip, timestamps);
      return false;
    }

    timestamps.push(now);
    ipConnections.set(ip, timestamps);
    return true;
  };

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws/live') {
      const origin = request.headers.origin;

      // 1. Origin check
      if (!isOriginAllowed(origin)) {
        debugWarn(`[Relay] Upgrade rejected: Unauthorized origin.`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // 2. Proxy-aware client IP extraction
      const clientIp = getClientIp(request, config.trustProxyHops);

      // Check brute-force lockout
      if (isIpLockedOut(clientIp)) {
        debugWarn(`[Relay] Upgrade rejected: IP ${clientIp} temporarily locked out.`);
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }

      // 3. Per-IP rate limiting
      if (!checkIpRateLimit(clientIp)) {
        debugWarn(`[Relay] Upgrade rejected: Rate limit exceeded.`);
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }

      // 4. Cap on concurrent sessions
      if (activeSessions >= config.maxConcurrentSessions) {
        debugWarn(`[Relay] Upgrade rejected: Max concurrent sessions (${config.maxConcurrentSessions}) reached.`);
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        socket.destroy();
        return;
      }

      // 5. Daily quota check
      const quotaCheck = quotaManager.canStartLiveSession();
      if (!quotaCheck.allowed) {
        debugWarn(`[Relay] Upgrade rejected: Daily quota reached.`);
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket, request: IncomingMessage) => {
    activeSessions++;
    const sessionStartTime = Date.now();
    const clientIp = getClientIp(request, config.trustProxyHops);
    debugLog(`[DEBUG][Relay] Client connected to WebSocket relay (active: ${activeSessions})`);

    // 6. Constant-time APP_PASSWORD verification with brute-force protection
    if (config.appPassword) {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const providedAuth =
        url.searchParams.get('auth') || (request.headers['x-app-password'] as string);

      if (!verifyPassword(providedAuth, config.appPassword)) {
        const { locked } = recordFailedAuth(clientIp);
        debugWarn('[DEBUG][Relay] Authentication failed for client connection.');
        clientWs.send(
          JSON.stringify({
            error: {
              message: locked
                ? 'Too many failed authentication attempts. Access temporarily locked.'
                : 'Authentication required. Invalid or missing app password.',
            },
          })
        );
        clientWs.close(1008, 'Authentication Failed');
        activeSessions = Math.max(0, activeSessions - 1);
        return;
      }
      // Clear failed attempts on valid login
      recordSuccessfulAuth(clientIp);
    }

    if (!config.geminiApiKey) {
      logError('[DEBUG][Relay] No GEMINI_API_KEY configured.');
      clientWs.send(
        JSON.stringify({
          error: {
            message:
              'GEMINI_API_KEY is not configured on the server. Please set it in your environment.',
          },
        })
      );
      clientWs.close(1008, 'API Key Missing');
      activeSessions = Math.max(0, activeSessions - 1);
      return;
    }

    const upstreamUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${config.geminiApiKey}`;

    let upstreamWs: WebSocket | null = null;
    let isClientClosed = false;

    // 7. Maximum session duration timer
    const sessionTimeout = setTimeout(() => {
      debugLog('[DEBUG][Relay] Session duration limit reached. Closing gracefully.');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: { message: 'Session duration limit reached. Reconnect to start a new session.' },
          })
        );
        clientWs.close(1000, 'Session duration limit reached');
      }
    }, config.maxSessionDurationMs);

    try {
      upstreamWs = new WebSocket(upstreamUrl);
    } catch (err) {
      logError('[DEBUG][Relay] Failed to create upstream WebSocket:', err);
      clientWs.close(1011, 'Upstream Connection Error');
      clearTimeout(sessionTimeout);
      activeSessions = Math.max(0, activeSessions - 1);
      return;
    }

    // Queue messages sent by client before upstream is open
    const clientMessageQueue: (string | Buffer)[] = [];

    upstreamWs.on('open', () => {
      debugLog('[DEBUG][Relay] Upstream connection to Gemini Live: OPEN');
      while (clientMessageQueue.length > 0 && upstreamWs?.readyState === WebSocket.OPEN) {
        const msg = clientMessageQueue.shift();
        if (msg) upstreamWs.send(msg);
      }
    });

    upstreamWs.on('message', (data: Buffer | string) => {
      try {
        const str = data.toString();
        const parsed = JSON.parse(str);
        if (parsed.setupComplete) {
          debugLog('[DEBUG][Relay] Upstream setup complete received from Gemini Live');
        }
        if (parsed.error) {
          logError(
            '[DEBUG][Relay] Upstream server error message:',
            parsed.error.message || JSON.stringify(parsed.error)
          );
        }
      } catch {
        // Non-JSON or binary payload
      }

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    upstreamWs.on('error', (err: Error) => {
      logError('[DEBUG][Relay] Gemini Live upstream error:', err.message || err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: { message: 'Gemini Live WebSocket upstream connection error.' },
          })
        );
      }
    });

    upstreamWs.on('close', (code, reason) => {
      debugLog(`[DEBUG][Relay] Upstream closed: code=${code}, reason="${reason.toString()}"`);
      if (!isClientClosed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code, reason.toString());
      }
    });

    clientWs.on('message', (data: Buffer | string) => {
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(data.toString());
      } else {
        clientMessageQueue.push(data);
      }
    });

    clientWs.on('close', (code, reason) => {
      isClientClosed = true;
      clearTimeout(sessionTimeout);
      activeSessions = Math.max(0, activeSessions - 1);
      const sessionDurationMs = Date.now() - sessionStartTime;
      quotaManager.recordLiveSessionDuration(sessionDurationMs);
      debugLog(
        `[DEBUG][Relay] Client disconnected from relay: code=${code}, reason="${reason.toString()}" (active: ${activeSessions}, duration: ${Math.round(sessionDurationMs / 1000)}s)`
      );
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.close();
      }
    });

    clientWs.on('error', (err) => {
      logError('[DEBUG][Relay] Client WebSocket error:', err);
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.close();
      }
    });
  });
}
