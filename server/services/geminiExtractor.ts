import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import {
  ExtractionRequest,
  ExtractionResponse,
  ExtractionResponseSchema,
  RawLLMExtractionSchema,
  DecisionItem,
  ActionItem,
} from '../schema.js';
import { resolveRelativeDeadline } from '../utils/dateResolver.js';

const SYSTEM_INSTRUCTION = `You are a real-time executive meeting summariser and precision action-item extractor.
Your job is to continuously UPDATE an evolving meeting intelligence state based on incremental new transcript segments.

CRITICAL RULES:
1. UPDATE, DO NOT REGENERATE: Add newly discovered items, merge duplicates, and update status (e.g. mark done if the speaker confirmed completion). Retain existing IDs when updating an existing item.
2. ZERO HALLUCINATIONS: Never invent tasks, owners, decisions, or dates not explicitly stated in the conversation. Only capture clear decisions and explicit commitments.
3. PRESERVE MANUAL EDITS: If an action item has isManual=true in the existing list, do not alter its task text, owner, deadline, or status unless the new speech explicitly references and changes it.
4. ACTION ITEMS:
   - "task": concise actionable imperative verb phrase (e.g., "Send revised Q3 forecast").
   - "owner": specific person's name or null if unassigned or ambiguous.
   - "deadline": the spoken relative phrase verbatim (e.g. "Friday", "next Tuesday", "tomorrow evening", "end of month") or null if unspecified. DO NOT INVENT DATES OR TIMESTAMPS.
   - "priority": "high", "medium", or "low".
   - "status": "open" or "done".
   - "confidence": confidence score between 0.0 and 1.0 (e.g. 0.95 for direct commitment).
   - "sourceQuote": short verbatim snippet (under 15 words) proving this commitment was spoken. Keep sourceQuote EXACTLY as transcribed.
5. NAMES AND SPEECH CORRECTION:
   - If a list of Known Names and Terms is provided: correct likely speech-recognition errors ONLY by matching against that list (for example, if "Rabi" is spoken in the transcript and "Ravi" is in the known names list, set owner to "Ravi").
   - NEVER invent names that do not match the transcript or the known list. If the owner is ambiguous or unclear, set owner to null.
6. TIMESTAMPS:
   - DO NOT generate timestamps or dates for decisions or action items. All timestamps are managed by the application code.
7. DECISIONS: Concrete conclusions, agreements, or choices agreed upon by participants.
8. OPEN QUESTIONS: Unresolved topics or questions that were raised without an answer.
9. SUMMARY: A clear, concise 2-4 paragraph running overview of key topics discussed so far.

Return ONLY valid JSON matching this schema:
{
  "summary": string,
  "decisions": [{ "id": string (optional), "text": string }],
  "actionItems": [
    {
      "id": string (optional),
      "task": string,
      "owner": string | null,
      "deadline": string | null,
      "priority": "high" | "medium" | "low",
      "status": "open" | "done",
      "confidence": number,
      "sourceQuote": string
    }
  ],
  "openQuestions": [string]
}`;

/**
 * Calls Gemini generateContent to update the meeting state from the new transcript chunk.
 * Uses official @google/genai SDK, Zod schema validation, a 20-second timeout,
 * and 1 automatic retry on invalid JSON or validation failure.
 */
export async function extractMeetingState(
  payload: ExtractionRequest
): Promise<ExtractionResponse> {
  if (!config.geminiApiKey) {
    console.warn('[Extractor] GEMINI_API_KEY is not set. Generating simulated response for testing.');
    return generateSimulatedResponse(payload);
  }

  const knownTermsPrompt =
    payload.knownTerms && payload.knownTerms.length > 0
      ? `KNOWN NAMES AND TERMS IN THIS MEETING (use to correct speech-recognition errors):\n${payload.knownTerms.join(', ')}\n\n`
      : '';

  const prompt = `${knownTermsPrompt}Current State:
SUMMARY:
${payload.currentSummary || '(None yet)'}

EXISTING DECISIONS:
${JSON.stringify(payload.currentDecisions, null, 2)}

EXISTING ACTION ITEMS:
${JSON.stringify(payload.currentActionItems, null, 2)}

EXISTING OPEN QUESTIONS:
${JSON.stringify(payload.currentOpenQuestions, null, 2)}

---
NEW TRANSCRIPT SEGMENT:
"${payload.newTranscript}"

Update the state based on the new transcript segment according to the instructions.`;

  // First attempt with 20-second timeout, retry once if invalid JSON or validation failure
  let rawExtracted;
  try {
    rawExtracted = await executeGeminiExtraction(prompt, 20000);
  } catch (firstErr) {
    console.warn('[Extractor] First extraction attempt failed or timed out, retrying once...', firstErr);
    rawExtracted = await executeGeminiExtraction(
      `${prompt}\n\nIMPORTANT: The previous output had a formatting issue. You MUST output STRICT VALID JSON matching the schema.`,
      20000
    );
  }

  // Code-level post-processing: resolve relative deadlines and generate timestamps in code
  return processExtractionOutput(rawExtracted, payload);
}

async function executeGeminiExtraction(promptText: string, timeoutMs: number): Promise<unknown> {
  const model = config.geminiExtractModel;
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

  // Enforce a strict 20-second timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Extraction timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  const apiPromise = ai.models.generateContent({
    model,
    contents: promptText,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const response = await Promise.race([apiPromise, timeoutPromise]);
  const rawText = response.text;
  if (!rawText) {
    throw new Error('Gemini API returned empty candidate response.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    // Clean possible markdown code fences if model returned them
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    parsedJson = JSON.parse(cleaned);
  }

  // Validate raw structure with Zod
  const validatedRaw = RawLLMExtractionSchema.parse(parsedJson);
  return validatedRaw;
}

/**
 * Transforms raw LLM output into fully-typed ExtractionResponse with code-generated
 * timestamps and resolved relative deadlines.
 */
function processExtractionOutput(
  raw: unknown,
  payload: ExtractionRequest
): ExtractionResponse {
  const parsedRaw = RawLLMExtractionSchema.parse(raw);
  const nowIso = new Date().toISOString();
  const refDate = payload.referenceDate || nowIso;
  const tz = payload.userTimezone || 'UTC';

  // 1. Process Decisions: set timestamps in code, preserve existing ones
  const decisions: DecisionItem[] = parsedRaw.decisions.map((d, index) => {
    const existing = payload.currentDecisions.find(
      (ed) => ed.id === d.id || ed.text.toLowerCase().trim() === d.text.toLowerCase().trim()
    );
    return {
      id: d.id || existing?.id || `dec-${Date.now()}-${index}`,
      text: d.text.trim(),
      timestamp: existing?.timestamp || nowIso,
    };
  });

  // 2. Process Action Items: resolve relative deadlines in code, assign timestamps
  const actionItems: ActionItem[] = parsedRaw.actionItems.map((item, index) => {
    const existing = payload.currentActionItems.find(
      (ea) => ea.id === item.id || ea.task.toLowerCase().trim() === item.task.toLowerCase().trim()
    );

    // Resolve relative deadline in code
    const resolved = resolveRelativeDeadline(item.deadline, refDate, tz);

    return {
      id: item.id || existing?.id || `act-${Date.now()}-${index}`,
      task: item.task.trim(),
      owner: item.owner ? item.owner.trim() : null,
      deadline: resolved.originalPhrase, // Preserves original spoken phrase
      resolvedDeadline: resolved.resolvedDate, // Real resolved ISO date in user timezone
      createdAt: existing?.createdAt || nowIso,
      priority: item.priority || 'medium',
      status: existing?.status === 'done' ? 'done' : item.status || 'open',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.9,
      sourceQuote: item.sourceQuote ? item.sourceQuote.trim() : '',
      isManual: existing?.isManual || false,
    };
  });

  const response: ExtractionResponse = {
    summary: parsedRaw.summary || payload.currentSummary,
    decisions,
    actionItems,
    openQuestions: parsedRaw.openQuestions || [],
  };

  return ExtractionResponseSchema.parse(response);
}

function generateSimulatedResponse(payload: ExtractionRequest): ExtractionResponse {
  const simulatedSummary = payload.currentSummary
    ? `${payload.currentSummary}\n\nDiscussion progressed: ${payload.newTranscript.slice(0, 80)}...`
    : `Meeting started with discussion regarding: ${payload.newTranscript.slice(0, 100)}...`;

  return {
    summary: simulatedSummary,
    decisions: payload.currentDecisions,
    actionItems: payload.currentActionItems,
    openQuestions: payload.currentOpenQuestions,
  };
}
