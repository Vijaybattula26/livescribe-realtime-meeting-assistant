import dotenv from 'dotenv';
dotenv.config({ override: true });
import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import express from 'express';
import { createLiveSessionToken } from '../server/services/geminiLiveAuth.js';
import { setupWebSocketProxy } from '../server/websocketProxy.js';

async function runLiveSmokeTest() {
  console.log('=== LiveScribe Live API Smoke Test ===');

  // Step 1: Start a temporary local test server with WebSocket proxy & token endpoint
  const app = express();
  app.use(express.json());
  app.post('/api/live-token', async (_req, res) => {
    try {
      const data = await createLiveSessionToken();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const server = createServer(app);
  setupWebSocketProxy(server);

  await new Promise<void>((resolve) => {
    server.listen(3099, () => {
      console.log('Local test server listening on port 3099');
      resolve();
    });
  });

  try {
    // Step 2: Request token from the server
    console.log('1. Requesting live token from local server...');
    const tokenRes = await fetch('http://localhost:3099/api/live-token', { method: 'POST' });
    if (!tokenRes.ok) {
      throw new Error(`Token request failed with status ${tokenRes.status}`);
    }
    const tokenData = (await tokenRes.json()) as {
      token: string;
      url: string;
      model: string;
      mode: 'ephemeral' | 'relay';
    };
    console.log(`   Token received! Mode: ${tokenData.mode}, Model: ${tokenData.model}`);

    // Step 3: Connect to Live session
    let wsUrl = tokenData.url;
    if (tokenData.mode === 'relay') {
      wsUrl = 'ws://localhost:3099/ws/live';
    }
    console.log(`2. Connecting to WebSocket Live endpoint...`);

    const ws = new WebSocket(wsUrl);
    let transcriptReceived = '';

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Live smoke test timed out waiting for transcript.'));
      }, 30000);

      ws.on('open', () => {
        console.log('   Connected! Sending Live setup frame...');
        const setupMessage = {
          setup: {
            model: `models/${tokenData.model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
            inputAudioTranscription: {},
            systemInstruction: {
              parts: [{ text: 'You are a real-time transcription assistant.' }],
            },
          },
        };
        ws.send(JSON.stringify(setupMessage));
      });

      ws.on('message', (data: Buffer) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.setupComplete) {
            console.log('3. Setup complete acknowledged! Streaming 16kHz PCM audio...');
            streamAudio(ws);
          }

          if (parsed.serverContent) {
            const finalTxt = parsed.serverContent.inputTranscription?.text;
            const interimTxt = parsed.serverContent.interimInputTranscription?.text;

            if (interimTxt) {
              process.stdout.write(`   [Interim] ${interimTxt}\r`);
            }
            if (finalTxt) {
              console.log(`\n4. Final transcript received: "${finalTxt}"`);
              transcriptReceived = finalTxt;
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          }
        } catch (e: any) {
          console.error('Error handling message:', e.message);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on('close', (code, reason) => {
        console.log(`   WebSocket closed: ${code} - ${reason.toString()}`);
        if (!transcriptReceived) {
          clearTimeout(timeout);
          reject(new Error(`WebSocket closed without transcript: ${code} ${reason}`));
        }
      });
    });

    console.log('\n=== SMOKE TEST RESULT ===');
    console.log(`TRANSCRIPT: "${transcriptReceived}"`);
    console.log('STATUS: PASS');
  } finally {
    server.close();
  }
}

function streamAudio(ws: WebSocket) {
  const pcmPath = path.resolve('scripts/ravi-16k.pcm');
  if (!fs.existsSync(pcmPath)) {
    throw new Error(`PCM test clip missing at ${pcmPath}`);
  }

  const pcmData = fs.readFileSync(pcmPath);
  const chunkSize = 3200; // 100ms at 16kHz 16-bit mono
  let offset = 0;

  const interval = setInterval(() => {
    if (offset >= pcmData.length) {
      clearInterval(interval);
      console.log('   Audio streaming completed. Sent audioStreamEnd.');
      ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      return;
    }

    const chunk = pcmData.subarray(offset, Math.min(offset + chunkSize, pcmData.length));
    offset += chunkSize;

    const base64Chunk = chunk.toString('base64');
    const msg = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Chunk,
        },
      },
    };
    ws.send(JSON.stringify(msg));
  }, 100);
}

runLiveSmokeTest().catch((err) => {
  console.error('\nSmoke test failed:', err);
  process.exit(1);
});
