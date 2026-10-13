import dotenv from 'dotenv';
import path from 'path';

// Load .env with override: true in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
} else {
  dotenv.config();
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  geminiApiKey: string;
  geminiLiveModel: string;
  geminiExtractModel: string;
  allowedOrigin: string;
  appPassword: string;
  maxConcurrentSessions: number;
  maxSessionDurationMs: number;
  trustProxyHops: number;
  dailyLiveSessionMinutesLimit: number;
  dailyExtractionCallsLimit: number;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
  geminiExtractModel: process.env.GEMINI_EXTRACT_MODEL || 'gemini-3.1-flash-lite',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  appPassword: process.env.APP_PASSWORD || '',
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10', 10),
  maxSessionDurationMs: parseInt(process.env.MAX_SESSION_DURATION_MS || '900000', 10), // default 15 mins
  trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS || '1', 10),
  dailyLiveSessionMinutesLimit: parseInt(process.env.DAILY_LIVE_SESSION_MINUTES_LIMIT || '120', 10),
  dailyExtractionCallsLimit: parseInt(process.env.DAILY_EXTRACTION_CALLS_LIMIT || '200', 10),
};

// Security startup assertions:
// In production, refuse to start unless APP_PASSWORD is set, ALLOWED_ORIGIN is set, and GEMINI_API_KEY is present.
// Fail with a clear message that NEVER prints the values.
if (config.nodeEnv === 'production' && process.env.NODE_ENV !== 'test') {
  if (!config.geminiApiKey) {
    throw new Error(
      'Fatal startup error [PRODUCTION]: GEMINI_API_KEY is missing from environment. Application cannot start.'
    );
  }
  if (!config.appPassword) {
    throw new Error(
      'Fatal startup error [PRODUCTION]: APP_PASSWORD is required in production mode to protect public access.'
    );
  }
  if (!config.allowedOrigin || config.allowedOrigin === 'http://localhost:5173') {
    throw new Error(
      'Fatal startup error [PRODUCTION]: ALLOWED_ORIGIN must be set to the deployed public URL in production mode.'
    );
  }
} else if (!config.geminiApiKey && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'Fatal startup error: GEMINI_API_KEY is missing from environment. Please set GEMINI_API_KEY in .env.'
  );
}
