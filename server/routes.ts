import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createLiveSessionToken } from './services/geminiLiveAuth.js';
import { extractMeetingState } from './services/geminiExtractor.js';
import { ExtractionRequestSchema } from './schema.js';
import { quotaManager } from './utils/quotaManager.js';

export const apiRouter = Router();

// Rate limiter for live token generation (e.g., max 30 per minute per IP)
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many live token requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for extraction calls (e.g., max 30 per minute per IP)
const extractLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many extraction requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Health check endpoint for container orchestrators (e.g. Cloud Run, Kubernetes)
 */
apiRouter.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    quota: quotaManager.getStatus(),
  });
});

/**
 * POST /api/live-token
 * Generates an ephemeral token or relay session credentials for Gemini Live API
 */
apiRouter.post('/api/live-token', tokenLimiter, async (_req, res) => {
  try {
    const sessionToken = await createLiveSessionToken();
    res.json(sessionToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate Live session token';
    console.error('[API] Error in /api/live-token:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/extract
 * Extracts and updates summary, decisions, action items, and open questions
 */
apiRouter.post('/api/extract', extractLimiter, async (req, res) => {
  try {
    const quotaCheck = quotaManager.checkAndRecordExtraction();
    if (!quotaCheck.allowed) {
      res.status(429).json({
        error: quotaCheck.reason,
        dailyLimitReached: true,
      });
      return;
    }

    const parsedRequest = ExtractionRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({
        error: 'Invalid request payload',
        details: parsedRequest.error.issues,
      });
      return;
    }

    const updatedState = await extractMeetingState(parsedRequest.data);
    res.json(updatedState);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    console.error('[API] Error in /api/extract:', error);
    res.status(500).json({ error: message });
  }
});
