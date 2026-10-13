# LiveScribe Real-World Audio Microphone Evaluation

This document provides a structured evaluation suite and template for measuring real-world speech recognition and task extraction accuracy using live microphone input.

---

## 📋 Evaluation Instructions

1. Start LiveScribe (`npm run dev`) or open your deployed instance.
2. In the "Known names & terms" field, enter the scenario's specified names (if any).
3. Click **"Start listening"** (or press `Space`) and speak the script aloud at normal conversational speed.
4. Allow the 30-second extraction timer to trigger, or click **"Extract now"** (`E`).
5. Record the results in the table below:
   - **Correct**: Actions accurately captured with correct task description, owner, and deadline.
   - **Missed**: Valid action items mentioned in the speech that were omitted.
   - **Wrong**: Hallucinated tasks, incorrect owners (invented names), or erroneous dates.
   - **Notes**: Acoustic notes (misheard words, background noise, etc.).

---

## 🎙️ 10 Standard Test Scenarios

### Scenario 1: Messy Meeting
- **Known Names:** `Sarah, Mark`
- **Script:** *"Um, so like, regarding the database migration... uh wait, who was doing that? Maybe Mark? No wait, Mark is out sick. Sarah, can you please take ownership of the log indexing by tomorrow afternoon? Yeah, let's do that."*
- **Expected Items:** Task: Take ownership of log indexing | Owner: `Sarah` | Deadline: tomorrow afternoon

### Scenario 2: Fast Speech
- **Known Names:** `Karthik`
- **Script:** *"Quick update team! Karthik must deploy the hotfix to staging before 5 PM today and immediately run the smoke test suite before notifying customer support."*
- **Expected Items:** 
  1. Task: Deploy hotfix to staging | Owner: `Karthik` | Deadline: 5 PM today
  2. Task: Run smoke test suite | Owner: `Karthik` | Deadline: today

### Scenario 3: Background Noise
- **Known Names:** `Vikram`
- **Script:** *(Spoken with ambient background noise or cafeteria chatter)* *"Could someone grab that door? Thanks. Okay back to business. Vikram, please audit the AWS cloud costs before the end of the month. We are spending way too much on unused idle instances."*
- **Expected Items:** Task: Audit AWS cloud costs | Owner: `Vikram` | Deadline: end of the month

### Scenario 4: Names Outside the Known List
- **Known Names:** *(Leave blank)*
- **Script:** *"Tsubasa mentioned in Slack that somebody needs to review PR 104 by tomorrow morning. Can someone take a look?"*
- **Expected Items:** Task: Review PR 104 | Owner: `null` (Unassigned) — MUST NOT invent an owner | Deadline: tomorrow morning

### Scenario 5: Overlapping Tasks
- **Known Names:** `Priya`
- **Script:** *"Priya, by Wednesday evening we need three things from you: finalize the pitch deck slides, review the vendor NDA, and send the summary email to legal."*
- **Expected Items:**
  1. Task: Finalize pitch deck slides | Owner: `Priya` | Deadline: Wednesday evening
  2. Task: Review vendor NDA | Owner: `Priya` | Deadline: Wednesday evening
  3. Task: Send summary email to legal | Owner: `Priya` | Deadline: Wednesday evening

### Scenario 6: A Correction Like "Actually Make It Thursday"
- **Known Names:** `Ravi`
- **Script:** *"Ravi, please finish drafting the Q3 hiring plan by Friday. Oh wait, actually, executive leadership meets on Thursday morning, so make that Thursday morning instead of Friday."*
- **Expected Items:** Task: Finish drafting Q3 hiring plan | Owner: `Ravi` | Deadline: Thursday morning (MUST NOT retain the superseded Friday deadline)

### Scenario 7: A Task Completed Later
- **Known Names:** `Alex`
- **Script:** *"Alex, can you look into bug ticket 402 today? Oh wait, Alex just messaged in chat saying ticket 402 is already fixed and verified in staging. Great, that's done."*
- **Expected Items:** Task: Fix bug ticket 402 | Owner: `Alex` | Status: `done` (Marked complete, not open)

### Scenario 8: A Question with No Answer
- **Known Names:** *(None)*
- **Script:** *"Does anyone know if the SOC2 compliance audit starts this month or next quarter? We haven't received confirmation from the security firm yet."*
- **Expected Items:** Zero Action Items | Question: "Does anyone know if SOC2 audit starts this month or next quarter?"

### Scenario 9: A Decision with a Deadline
- **Known Names:** *(None)*
- **Script:** *"We had a long debate about MongoDB versus PostgreSQL. We finally decided to migrate the primary database to PostgreSQL by the end of Q4."*
- **Expected Items:** Zero Action Items | Decision: "Migrate primary database to PostgreSQL by the end of Q4"

### Scenario 10: A Long Monologue
- **Known Names:** `David`
- **Script:** *"Over the past three weeks we have been looking at our infrastructure telemetry and we noticed that memory usage on the websocket gateways has been creeping upwards during peak US trading hours. It could be buffer leaks in the socket pool or it could be garbage collection pauses under node 22. Regardless of the underlying root cause, David, please profile the gateway memory footprint by next Tuesday so we can decide whether to provision more nodes."*
- **Expected Items:** Task: Profile gateway memory footprint | Owner: `David` | Deadline: next Tuesday

---

## 📊 Live Microphone Results Table Template

| Scenario | Spoken Script Summary | Expected Items | Actual Items | Correct | Missed | Wrong | Notes |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
| 1. Messy meeting | Log indexing by Sarah | 1 | | | | | |
| 2. Fast speech | Hotfix & smoke tests | 2 | | | | | |
| 3. Background noise | AWS cost audit | 1 | | | | | |
| 4. Names outside list | Review PR 104 (unassigned) | 1 | | | | | |
| 5. Overlapping tasks | Deck, NDA, and email legal | 3 | | | | | |
| 6. Correction ("actually Thursday") | Hiring plan by Thursday | 1 | | | | | |
| 7. Task completed later | Ticket 402 verified done | 1 | | | | | |
| 8. Question with no answer | SOC2 timing inquiry | 0 | | | | | |
| 9. Decision with deadline | Migrate to Postgres by Q4 | 0 | | | | | |
| 10. Long monologue | Profile gateway memory | 1 | | | | | |
| **Total** | | **11** | | | | | |

---

## 📐 Evaluation Metrics Formula

Calculate Precision and Recall after filling in the table above:

$$\text{Precision} = \frac{\text{Correct}}{\text{Correct} + \text{Wrong}} \times 100\%$$

$$\text{Recall} = \frac{\text{Correct}}{\text{Correct} + \text{Missed}} \times 100\%$$
