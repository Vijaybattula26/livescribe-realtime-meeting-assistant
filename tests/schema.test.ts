import { describe, it, expect } from 'vitest';
import {
  ExtractionResponseSchema,
  ActionItemSchema,
  ExtractionRequestSchema,
} from '../server/schema';

describe('Extraction Schema Validation', () => {
  it('should successfully parse valid complete extraction response', () => {
    const validData = {
      summary: 'Discussed project deadlines and assigned engineering tasks.',
      decisions: [
        {
          id: 'dec-1',
          text: 'Agreed to release beta on Friday',
          timestamp: '14:20',
        },
      ],
      actionItems: [
        {
          id: 'act-1',
          task: 'Send the revised revenue report',
          owner: 'Ravi',
          deadline: 'Friday',
          priority: 'high',
          status: 'open',
          confidence: 0.95,
          sourceQuote: 'Ravi will send the report by Friday',
        },
      ],
      openQuestions: ['Who will approve the budget for next quarter?'],
    };

    const parsed = ExtractionResponseSchema.parse(validData);
    expect(parsed.summary).toBe(validData.summary);
    expect(parsed.actionItems).toHaveLength(1);
    expect(parsed.actionItems[0].owner).toBe('Ravi');
    expect(parsed.actionItems[0].priority).toBe('high');
    expect(parsed.decisions[0].text).toBe('Agreed to release beta on Friday');
  });

  it('should apply defaults for missing optional fields', () => {
    const minimalData = {
      summary: 'Quick standup overview',
    };

    const parsed = ExtractionResponseSchema.parse(minimalData);
    expect(parsed.decisions).toEqual([]);
    expect(parsed.actionItems).toEqual([]);
    expect(parsed.openQuestions).toEqual([]);
  });

  it('should validate ActionItem constraints and priority enums', () => {
    const invalidItem = {
      id: 'item-1',
      task: 'Do something',
      priority: 'super-urgent', // Invalid priority enum
    };

    expect(() => ActionItemSchema.parse(invalidItem)).toThrow();
  });

  it('should validate confidence score bounds (0 to 1)', () => {
    const outOfBoundsItem = {
      id: 'item-2',
      task: 'Check logs',
      confidence: 1.5, // > 1
    };

    expect(() => ActionItemSchema.parse(outOfBoundsItem)).toThrow();
  });

  it('should validate ExtractionRequest payload', () => {
    const validRequest = {
      newTranscript: 'Ravi mentioned he will prepare the slides tonight.',
      currentSummary: 'Team meeting discussion.',
      currentDecisions: [],
      currentActionItems: [],
      currentOpenQuestions: [],
    };

    const parsed = ExtractionRequestSchema.parse(validRequest);
    expect(parsed.newTranscript).toBe(validRequest.newTranscript);

    // Empty newTranscript should fail validation
    expect(() =>
      ExtractionRequestSchema.parse({
        newTranscript: '',
      })
    ).toThrow();
  });
});
