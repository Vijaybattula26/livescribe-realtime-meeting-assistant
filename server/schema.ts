import { z } from 'zod';

export const DecisionItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  timestamp: z.string().default(() => new Date().toISOString()),
});

export const ActionItemSchema = z.object({
  id: z.string(),
  task: z.string(),
  owner: z.string().nullable().optional().default(null),
  deadline: z.string().nullable().optional().default(null), // Spoken phrase e.g. "Friday"
  resolvedDeadline: z.string().nullable().optional().default(null), // Resolved ISO 8601 date string
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['open', 'done']).default('open'),
  confidence: z.number().min(0).max(1).default(0.9),
  sourceQuote: z.string().default(''),
  // Optional flag to indicate if manually edited by user
  isManual: z.boolean().optional().default(false),
});

/**
 * Raw output schema requested from the Gemini model.
 * Note: Timestamps and date resolutions are deliberately excluded from LLM generation
 * to prevent invented dates and hallucinated timestamps.
 */
export const RawLLMDecisionSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
});

export const RawLLMActionItemSchema = z.object({
  id: z.string().optional(),
  task: z.string(),
  owner: z.string().nullable().optional().default(null),
  deadline: z.string().nullable().optional().default(null), // original spoken phrase only
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['open', 'done']).default('open'),
  confidence: z.number().min(0).max(1).default(0.9),
  sourceQuote: z.string().default(''),
});

export const RawLLMExtractionSchema = z.object({
  summary: z.string().default(''),
  decisions: z.array(RawLLMDecisionSchema).default([]),
  actionItems: z.array(RawLLMActionItemSchema).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export const ExtractionResponseSchema = z.object({
  summary: z.string().default(''),
  decisions: z.array(DecisionItemSchema).default([]),
  actionItems: z.array(ActionItemSchema).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export const ExtractionRequestSchema = z.object({
  newTranscript: z.string().min(1, 'New transcript cannot be empty'),
  currentSummary: z.string().default(''),
  currentDecisions: z.array(DecisionItemSchema).default([]),
  currentActionItems: z.array(ActionItemSchema).default([]),
  currentOpenQuestions: z.array(z.string()).default([]),
  knownTerms: z.array(z.string()).optional().default([]),
  userTimezone: z.string().optional().default('UTC'),
  referenceDate: z.string().optional().default(() => new Date().toISOString()),
});

export type DecisionItem = z.infer<typeof DecisionItemSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type RawLLMExtraction = z.infer<typeof RawLLMExtractionSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;
export type ExtractionRequest = z.infer<typeof ExtractionRequestSchema>;
