# LiveScribe Resume Bullet Options

Use these bullet options for Software Engineering (Full Stack / Systems) and AI / ML Engineering resumes. Replace the `[PLACEHOLDERS]` with numbers you measure from your real-world evaluation and test runs.

---

### Option 1: AI / ML & Real-Time Audio Systems (Tailored for Applied AI & LLM Systems Roles)

- **Architected and built LiveScribe**, an end-to-end real-time meeting intelligence platform streaming 16kHz PCM audio over bidirectional WebSockets to the Google Gemini Live Multimodal API, delivering live speech transcription with **[MEASURED_LATENCY_MS] ms** round-trip latency. Implemented structured zero-shot extraction using Gemini Flash with Zod schema validation, relative calendar deadline resolution, and domain-term grounding, achieving **[REAL_AUDIO_PRECISION]% precision** and **[REAL_AUDIO_RECALL]% recall** across a 10-scenario real-world audio benchmark.

---

### Option 2: Full-Stack SWE & Distributed Security (Tailored for Senior / Full-Stack SWE Roles)

- **Engineered a production-ready React 19 and Node.js speech intelligence platform** featuring an audio-reactive canvas waveform UI, offline IndexedDB persistence, and an Express WebSocket relay that prevents API key leakage. Hardened deployment for Google Cloud Run with constant-time password authentication, configurable multi-hop proxy trust, per-client IP rate limiting, and daily session quotas; validated system resilience through **[TEST_COUNT] automated unit and integration tests** with 100% pass rate and zero security build leaks.

---

### Option 3: Performance, Web Audio & Product Engineering (Tailored for Product & Frontend/Systems Roles)

- **Designed and developed a real-time listening workspace in TypeScript and Tailwind CSS**, featuring an adaptive 60fps canvas waveform visualizer bound to live Web Audio API microphone levels with zero audio pipeline duplication. Implemented intelligent state deduplication, non-destructive user edit preservation, and accessible keyboard-first navigation (WCAG AA), backed by an automated CI evaluation pipeline and Docker multi-stage containerization on Google Cloud Run.

---

### Metric Measurement Checklist for Filling Placeholders:
1. `[MEASURED_LATENCY_MS]`: Measure average latency reported in the UI status pill badge during live microphone streaming (typically 120–220 ms).
2. `[REAL_AUDIO_PRECISION]`: Calculate from your filled `eval/real-audio-results.md` table using $\frac{\text{Correct}}{\text{Correct} + \text{Wrong}} \times 100$.
3. `[REAL_AUDIO_RECALL]`: Calculate from your filled `eval/real-audio-results.md` table using $\frac{\text{Correct}}{\text{Correct} + \text{Missed}} \times 100$.
4. `[TEST_COUNT]`: Currently `48` tests in Vitest test suite (`vitest run`).
