# LiveScribe: 60-Second Video Demo Script

This script provides second-by-second narration and visual cues for recording a 60-second video walkthrough of LiveScribe.

---

### Setup Before Recording
- Browser window sized to **1440 × 900** at `http://localhost:5173/`.
- Dark or Light theme enabled.
- "Known names & terms" pre-filled with: `Ravi, Priya`.
- Microphone plugged in and audio input verified.
- Screen recording set to 1080p 60fps.

---

### Timeline & Actions

| Timestamp | Visual Action (What to Show) | Narration (What to Say) | Key Element Highlighted |
|:---|:---|:---|:---|
| **00:00 – 00:08** | Cursor hovers over LiveScribe header. Point to the calm typography and the flat idle ribbon line. | *"Meetings move fast, but manual note-taking pulls you out of the conversation. LiveScribe is a calm listening instrument that turns real-time conversation into structured action items without distraction."* | Instrument Serif wordmark, flat idle ribbon line, clean two-panel workspace. |
| **00:08 – 00:18** | Click **"Start listening"** (or hit `Space`). Observe the live audio ribbon waking up from a flat line into cobalt sine waves. | *"I'll hit Start listening. Notice the signature live ribbon wake up—it reacts directly to my voice volume with zero latency."* | Wake-up animation (~600ms), dynamic waveform following voice amplitude, `● Live` status pill with latency badge. |
| **00:18 – 00:32** | Speak the test script aloud:<br/>*"Okay, let's wrap up. Ravi will send the revenue report by Friday. Priya, please book the client demo for next Tuesday. We decided to postpone the website launch to November. Does anyone know if the budget is approved? I will update the project plan by tomorrow evening."* | *(Spoken naturally)*<br/>Watch the left panel stream interim italics and lock in finalized segments along the time rail. | Streaming interim italic text, permanent timestamp rail in JetBrains Mono, real-time waveform oscillation. |
| **00:32 – 00:44** | Click **"Extract now"** (or press keyboard shortcut `E`). Point out the subtle progress state. | *"At any point, we can trigger instant extraction. Gemini analyzes the transcript through a strict schema."* | "Extract now" button with last updated time, non-blocking toast notification. |
| **00:44 – 00:54** | Right panel updates. Hover over the action items: show owner chips (`@Ravi`, `@Priya`), combined due chips (`Friday · 17 Oct`), priority badges, and the serif minutes summary tab. | *"Within seconds, we have concrete action items with resolved calendar dates, clear ownership, and confidence ratings, plus a meeting summary in clean editorial prose. No hallucinations, and no duplicate tasks."* | Combined date chips (`Friday · 17 Oct`), ownership badges, source quotes, serif minutes summary. |
| **00:54 – 01:00** | Click **"Stop"** (toast announces "Stopped"). Open the overflow menu, show Markdown / JSON export and dark/light mode toggle. | *"All data stays local in IndexedDB, with instant Markdown and JSON export. LiveScribe: say it once, we'll keep the notes."* | Overflow menu, Markdown export preview, theme toggle, graceful shutdown. |

---

### Tips for Recording
1. **Speaking Pace**: Speak clearly at normal conversational speed; avoid robotic cadence.
2. **Shortcuts**: Use `Space` to start/pause and `E` to extract to demonstrate keyboard accessibility.
3. **Cursor Movement**: Move smoothly between the ribbon and panels without erratic jerking.
