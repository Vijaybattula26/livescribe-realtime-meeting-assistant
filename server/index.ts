import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { apiRouter } from './routes.js';
import { setupWebSocketProxy } from './websocketProxy.js';
import { verifyConfiguredModels } from './services/modelHealth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configure proxy trust for Cloud Run and reverse proxies
app.set('trust proxy', config.trustProxyHops > 0 ? config.trustProxyHops : false);

// Security and CORS configuration
const allowedOrigins = [
  config.allowedOrigin,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
      if (!origin || allowedOrigins.includes(origin) || config.nodeEnv === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Mount API routes
app.use(apiRouter);

// In production, serve the built React frontend static files
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// For SPA routing, serve index.html for non-API requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/healthz')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // If dist/index.html doesn't exist yet (e.g. running dev server standalone)
      res.status(200).send('LiveScribe Server API Running. Frontend is being served on Vite dev server.');
    }
  });
});

const server = http.createServer(app);

// Mount the WebSocket proxy relay
setupWebSocketProxy(server);

server.listen(config.port, async () => {
  console.log(`=========================================`);
  console.log(`🎙️  LiveScribe Server Running`);
  console.log(`   Port:          ${config.port}`);
  console.log(`   Environment:   ${config.nodeEnv}`);
  console.log(`   Live Model:    ${config.geminiLiveModel}`);
  console.log(`   Extract Model: ${config.geminiExtractModel}`);
  console.log(`   API Key Set:   ${config.geminiApiKey ? 'YES' : 'NO (simulated mode)'}`);
  console.log(`=========================================`);

  // Run model health check without blocking or crashing server
  await verifyConfiguredModels().catch((err) => {
    console.error('[Model Health] Unexpected check error:', err);
  });
});
