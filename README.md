# LiveScribe: Real-Time Audio Summariser & Action-Item Extractor

LiveScribe is a calm, focused listening instrument that transforms real-time speech into structured meeting intelligence without breaking conversational flow. Built with React 19, TypeScript, and a hardened Node.js WebSocket relay, it captures 16kHz microphone audio via the Web Audio API, streams it directly to Google's Gemini Multimodal Live API (`gemini-3.1-flash-live-preview`), renders low-latency transcripts alongside an audio-reactive canvas waveform, and extracts schema-validated action items, calendar-resolved deadlines, decisions, and meeting summaries using Gemini Flash (`gemini-3.1-flash-lite`).

---

## 📸 Screenshots

| Dark Mode (Default) | Light Mode |
|:---:|:---:|
| ![LiveScribe Dark Mode](docs/screenshots/desktop-dark.png) | ![LiveScribe Light Mode](docs/screenshots/desktop-light.png) |

*(Screenshots can be placed in `docs/screenshots/`)*

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Browser ["Client: React 19 + TypeScript + Vite + Tailwind CSS"]
        Mic["Microphone (getUserMedia)"] --> AW["AudioWorklet (16kHz PCM mono)"]
        AW --> Ribbon["Live Ribbon (Canvas Waveform)"]
        AW --> WSC["WebSocket Client"]
        IDB[("IndexedDB Storage<br/>(Transcripts, State, Known Names)")] <--> UI["Live Dashboard UI"]
        UI --> ExtTrigger["Auto (30s) / 'Extract now'"]
    end

    subgraph Backend ["Node.js / Express Server (Cloud Run / Docker)"]
        WSRelay["Hardened WebSocket Relay (/ws/live)<br/>• Proxy-Aware Client IP (Cloud Run)<br/>• Origin Verification (ALLOWED_ORIGIN)<br/>• Per-IP Rate Limiting (25/min)<br/>• Concurrent Session Cap (10)<br/>• Max Duration Timer (15 min)<br/>• Constant-Time APP_PASSWORD Gate<br/>• Brute-Force Lockout Protection<br/>• Daily Live Session Quota Cap"]
        ExtractRoute["POST /api/extract<br/>• Zod Schema Validation<br/>• Code Date Resolver (User Timezone)<br/>• Known-Names Speech Correction<br/>• 20s Timeout + 1 Auto-Retry<br/>• Daily Extraction Quota Cap"]
        TokenRoute["POST /api/live-token"]
        Healthz["GET /healthz<br/>(Uptime + Quota Status)"]
    end

    subgraph Gemini ["Google Generative AI Cloud"]
        LiveAPI["Gemini Multimodal Live API<br/>(gemini-3.1-flash-live-preview)"]
        FlashAPI["Gemini Flash Lite<br/>(gemini-3.1-flash-lite)"]
    end

    WSC <-->|Bidirectional Audio & Transcription| WSRelay
    WSRelay <-->|Upstream Stream (GEMINI_API_KEY never leaks)| LiveAPI
    ExtTrigger -->|Incremental Transcript + Context| ExtractRoute
    ExtractRoute <-->|Structured JSON Extraction| FlashAPI
    TokenRoute -.->|Session Token| WSC
```

---

## ✨ Features

- **Signature Live Audio Ribbon**: 72px canvas waveform oscillating to real microphone levels with graceful wake-up animation, 60fps frame rate cap, tab-visibility pausing, and `prefers-reduced-motion` fallback.
- **Low-Latency Streaming Transcription**: Real-time interim hypotheses in quiet italic style transitioning seamlessly into final turns with millisecond timestamps.
- **Deterministic Date Resolution**: Calendar deadlines are resolved in code against real clock time and the browser timezone (e.g., "Friday" $\rightarrow$ `2026-10-16`), storing both spoken phrase and ISO date.
- **Known-Names Grounding**: Corrects speech-recognition inaccuracies (e.g., "Rabi" $\rightarrow$ "Ravi") strictly against user-supplied terms, defaulting ambiguous speakers to `null` instead of inventing names.
- **Zero-Duplication Merge Logic**: Incremental extractions update existing items without duplicates, preserving manual user edits, titles, and completed task states.
- **Accessible & Keyboard-First**: Complete WCAG AA contrast in both themes, 44px mobile touch targets, accessible ARIA landmarks (`role="dialog"`, `tablist`), and global keyboard shortcuts (`Space`, `E`, `/`, `?`, `Esc`).
- **Offline Persistence & Export**: Transcripts, meeting states, and custom names persist locally in IndexedDB with one-click Markdown and JSON export.

---

## 💻 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas API, IndexedDB (`idb`).
- **Backend**: Node.js, Express, WebSocket (`ws`), `@google/genai` SDK, Zod, `dotenv`, `cors`, `express-rate-limit`.
- **Testing & Quality**: Vitest, ESLint, TypeScript compiler (`tsc --noEmit`).
- **Deployment**: Docker (multi-stage Alpine image), Google Cloud Run, Google Cloud Secret Manager.

---

## 🔒 Security Model

1. **Zero Client Key Exposure**:
   - `GEMINI_API_KEY` never reaches the browser. All client requests route through the server relay at `/ws/live` and `/api/extract`.
   - CI secret scanner (`tests/securityBuild.test.ts`) verifies that client production bundles in `dist/` never contain API keys or Google key patterns (`AQ.*`, `AIza*`).
2. **Public Deployment Shielding**:
   - In production (`NODE_ENV=production`), startup fails immediately if `APP_PASSWORD`, `ALLOWED_ORIGIN`, or `GEMINI_API_KEY` are missing.
   - Passwords are verified using timing-safe comparisons (`crypto.timingSafeEqual`) with per-IP rate limiting and lockout after 5 consecutive failed attempts.
3. **Spend & Quota Guardrails**:
   - Configurable in-memory caps on daily live audio minutes (`DAILY_LIVE_SESSION_MINUTES_LIMIT`) and extraction requests (`DAILY_EXTRACTION_CALLS_LIMIT`) prevent unexpected billing overruns.
4. **Cloud Run Proxy-Aware Rate Limiting**:
   - `app.set('trust proxy', TRUST_PROXY_HOPS)` ensures rate limiting is anchored to verified client IPs from Google Cloud Load Balancer rather than spoofed client headers.

---

## 🛠️ Environment Variables

Create a `.env` file in the root directory (see [`.env.example`](file:///d:/live_project/.env.example)):

```bash
# Required: Google Gemini API Key
GEMINI_API_KEY=AQ.your_google_key_here

# Models (Configurable)
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_EXTRACT_MODEL=gemini-3.1-flash-lite

# Server Configuration
PORT=3001
NODE_ENV=development

# Origin / CORS Protection
ALLOWED_ORIGIN=http://localhost:5173

# Security & Relay Hardening
APP_PASSWORD=your_secure_access_password
MAX_CONCURRENT_SESSIONS=10
MAX_SESSION_DURATION_MS=900000
TRUST_PROXY_HOPS=1

# Daily Quota Guardrails (Spend protection)
DAILY_LIVE_SESSION_MINUTES_LIMIT=120
DAILY_EXTRACTION_CALLS_LIMIT=200
DEBUG=false
```

---

## 🚀 Local Development & Testing

### 1. Installation
```bash
npm install
```

### 2. Start Development Servers
```bash
npm run dev
```
- Client interface: `http://localhost:5173`
- Backend API & Relay: `http://localhost:3001`
- Healthcheck endpoint: `http://localhost:3001/healthz`

### 3. Run Quality Gates
```bash
# Run unit, integration, and security build tests (49 tests)
npm test

# Run ESLint (0 errors, 0 warnings)
npm run lint

# TypeScript verification
npx tsc --noEmit

# Build production bundle
npm run build
```

### 4. Run Scripts
```bash
# Live API WebSocket smoke test with PCM audio
npx tsx scripts/live-smoke-test.ts

# 9-scenario regression suite
npx tsx scripts/eval-extraction.ts
```

---

## 📊 Evaluation & Benchmarking

### 1. Synthetic Regression Suite (9 Developer-Authored Scenarios)
The extraction regression test suite (`scripts/eval-extraction.ts`) verifies schema enforcement, date resolution, and deduplication across 9 developer-written synthetic scenarios:

| Test ID | Scenario Description | Expected Tasks | Extracted Tasks | Precision | Recall | Status |
|:-------:|:---------------------|:--------------:|:---------------:|:---------:|:------:|:------:|
| **TC-1** | Clear explicit tasks with owners and deadlines | 2 | 2 | 100% | 100% | PASS |
| **TC-2** | Conversational chat with zero tasks (hallucination check) | 0 | 0 | 100% | 100% | PASS |
| **TC-3** | Duplicate mentions (merge & update test) | 1 | 1 | 100% | 100% | PASS |
| **TC-4** | Completed task status update | 1 | 1 | 100% | 100% | PASS |
| **TC-5** | Ambiguous ownership (must resolve to null) | 1 | 1 | 100% | 100% | PASS |
| **TC-6** | Misheard name WITHOUT known-names list (null owner) | 1 | 1 | 100% | 100% | PASS |
| **TC-7** | Misheard name WITH known-names list (corrected to "Ravi") | 1 | 1 | 100% | 100% | PASS |
| **TC-8** | Relative deadline resolution ("Friday", "tomorrow evening") | 1 | 1 | 100% | 100% | PASS |
| **TC-9** | Decision plus open question (0 tasks) | 0 | 0 | 100% | 100% | PASS |

> **Honest Evaluation Note:** These results represent passing regression on 9 synthetic text scenarios written by the developer. Real-world acoustic speech accuracy varies depending on microphone quality, background noise, and pronunciation.

### 2. Real-World Microphone Audio Benchmark
For evaluating physical microphone audio, refer to [`eval/real-audio-results.md`](file:///d:/live_project/eval/real-audio-results.md). It contains 10 spoken test scripts (messy meetings, fast speech, ambient noise, deadline revisions, and completed tasks) and a template to calculate empirical precision and recall.

---

## 🚢 Google Cloud Run Deployment

Automated deployment is configured in [`deploy/cloudrun.sh`](file:///d:/live_project/deploy/cloudrun.sh):

```bash
# 1. Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Configure variables in deploy/cloudrun.sh
# Edit PROJECT_ID="YOUR_PROJECT_ID", REGION="us-central1", SERVICE_NAME="livescribe"

# 3. Execute automated deployment
chmod +x deploy/cloudrun.sh
./deploy/cloudrun.sh
```

### What `deploy/cloudrun.sh` Executes:
1. Enables Cloud Run, Secret Manager, Cloud Build, and Artifact Registry.
2. Pipes `GEMINI_API_KEY` and `APP_PASSWORD` from local `.env` directly into Secret Manager without printing them.
3. Grants the compute service account `roles/secretmanager.secretAccessor`.
4. Deploys container with `--set-secrets GEMINI_API_KEY=...,APP_PASSWORD=...`, `--timeout 3600` (WebSocket support), `--max-instances 2`, and `NODE_ENV=production`.
5. Updates `ALLOWED_ORIGIN` to match the deployed Cloud Run URL.

---

## ⚠️ Known Limitations

1. **Per-Instance Limits**: In-memory rate limiters, session caps, and daily quotas are tracked per Cloud Run container. The deployment script sets `--max-instances 2` to keep these boundaries tight. High-scale multi-region setups should use Redis.
2. **Speech Recognition on Unfamiliar Names**: If a proper noun is spoken that is absent from the "Known names & terms" list, Gemini Live may transcribe phonetic approximations (e.g., "Rabi" for "Ravi"). The extractor sets `owner: null` for ambiguous names rather than inventing an identity.
3. **Preview Model Lifecycle**: The Live API uses `gemini-3.1-flash-live-preview`. Google periodically updates preview tags; update `GEMINI_LIVE_MODEL` in `.env` without code changes.
4. **Cloud Run WebSocket Timeouts**: Default Cloud Run connections close after 300 seconds. LiveScribe uses `--timeout 3600` for uninterrupted 60-minute sessions.

---

## 🔮 Future Improvements

- **Speaker Diarization**: Multi-speaker attribution leveraging audio stream turn tags.
- **Calendar Integration**: One-click sync with Google Calendar and Microsoft Outlook for resolved deadlines.
- **Multi-Language Support**: Real-time cross-language transcription and multilingual task extraction.

---

## 📁 Repository Structure

```
├── deploy/
│   └── cloudrun.sh          # Automated Cloud Run & Secret Manager deployment script
├── docs/
│   ├── demo-script.md       # 60-second video demo walkthrough script
│   └── resume-bullets.md    # SWE and AI/ML resume bullet options with metric placeholders
├── eval/
│   └── real-audio-results.md# 10 real-world spoken audio test scripts & evaluation template
├── scripts/
│   ├── eval-extraction.ts   # 9-scenario synthetic regression extraction test suite
│   ├── live-smoke-test.ts   # Automated WebSocket PCM audio stream smoke test
│   └── ravi-16k.pcm         # 16kHz test audio fixture
├── server/
│   ├── config.ts            # Environment config, production guards, and secret safety
│   ├── index.ts             # Express HTTP entry point and SPA static server
│   ├── routes.ts            # /api/extract, /api/live-token, /healthz endpoints
│   ├── schema.ts            # Zod extraction schema and TypeScript interfaces
│   ├── services/            # Gemini Live auth and structured extraction services
│   ├── utils/               # Date resolver, auth security, client IP, quota manager
│   └── websocketProxy.ts    # Hardened WebSocket relay to Gemini Multimodal Live API
├── src/
│   ├── components/          # UI components (LiveRibbon, Header, TranscriptPanel, DashboardPanel, Modals)
│   ├── design-system.css    # Calm design tokens (Light & Dark mode custom properties)
│   ├── hooks/               # useLiveSession, useExtraction, useAudioCapture
│   └── utils/               # Storage, export formats, deduplication merge logic
├── tests/                   # 49 Vitest unit, integration, proxy, and secret-leak tests
├── Dockerfile               # Multi-stage production container build (non-root runner)
└── LICENSE                  # MIT License
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
