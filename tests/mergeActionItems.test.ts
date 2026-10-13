import { describe, it, expect } from 'vitest';
import {
  mergeActionItems,
  normalizeTaskText,
  computeSimilarity,
} from '../src/utils/mergeActionItems';
import { ActionItem } from '../src/types';

describe('Action Items Merge & Deduplication Logic', () => {
  it('should normalize text by stripping punctuation and lowercasing', () => {
    expect(normalizeTaskText('Send the Report, by Friday!!')).toBe('send the report by friday');
  });

  it('should compute high similarity for near-duplicate task descriptions', () => {
    const taskA = 'Ravi will send the financial report by Friday';
    const taskB = 'Send the financial report by Friday';
    const similarity = computeSimilarity(taskA, taskB);
    expect(similarity).toBeGreaterThan(0.6);
  });

  it('should add unique action items without affecting existing ones', () => {
    const existing: ActionItem[] = [
      {
        id: '1',
        task: 'Set up staging environment',
        owner: 'Alice',
        deadline: 'Monday',
        priority: 'high',
        status: 'open',
        confidence: 0.9,
        sourceQuote: 'Alice will set up staging',
      },
    ];

    const incoming: ActionItem[] = [
      {
        id: '2',
        task: 'Draft marketing copy',
        owner: 'Bob',
        deadline: 'Wednesday',
        priority: 'medium',
        status: 'open',
        confidence: 0.85,
        sourceQuote: 'Bob to draft copy',
      },
    ];

    const merged = mergeActionItems(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('1');
    expect(merged[1].id).toBe('2');
  });

  it('should NEVER overwrite manual user edits with incoming AI extractions', () => {
    const existing: ActionItem[] = [
      {
        id: '1',
        task: 'Manually edited task title',
        owner: 'Manually Assigned Person',
        deadline: 'Custom deadline',
        priority: 'high',
        status: 'done',
        confidence: 1.0,
        sourceQuote: 'Manual',
        isManual: true, // User edited this!
      },
    ];

    const incoming: ActionItem[] = [
      {
        id: '1',
        task: 'AI suggested task title',
        owner: 'Someone else',
        deadline: 'Tomorrow',
        priority: 'low',
        status: 'open',
        confidence: 0.7,
        sourceQuote: 'Said in speech',
      },
    ];

    const merged = mergeActionItems(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].task).toBe('Manually edited task title');
    expect(merged[0].owner).toBe('Manually Assigned Person');
    expect(merged[0].status).toBe('done');
  });

  it('should preserve user "done" status even if incoming extraction says "open"', () => {
    const existing: ActionItem[] = [
      {
        id: 'task-100',
        task: 'Deploy backend server',
        owner: 'DevOps',
        deadline: 'Today',
        priority: 'high',
        status: 'done', // User checked done
        confidence: 0.9,
        sourceQuote: 'Deploy backend',
      },
    ];

    const incoming: ActionItem[] = [
      {
        id: 'task-100',
        task: 'Deploy backend server',
        owner: 'DevOps',
        deadline: 'Today',
        priority: 'high',
        status: 'open', // AI extracted open
        confidence: 0.95,
        sourceQuote: 'Deploy backend',
      },
    ];

    const merged = mergeActionItems(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('done');
  });

  it('should deduplicate tasks that have different IDs but similar description', () => {
    const existing: ActionItem[] = [
      {
        id: 'first-id',
        task: 'Ravi will send the revenue report by Friday',
        owner: 'Ravi',
        deadline: 'Friday',
        priority: 'high',
        status: 'open',
        confidence: 0.8,
        sourceQuote: 'Ravi to send report',
      },
    ];

    const incoming: ActionItem[] = [
      {
        id: 'second-id-different',
        task: 'Send revenue report by Friday',
        owner: 'Ravi',
        deadline: 'Friday',
        priority: 'high',
        status: 'open',
        confidence: 0.95,
        sourceQuote: 'Ravi will send the report by Friday',
      },
    ];

    const merged = mergeActionItems(existing, incoming);
    // Should merge rather than creating a duplicate
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('first-id');
    expect(merged[0].confidence).toBe(0.95); // updated to higher confidence
  });

  it('runs extraction merge twice on the same transcript and confirms zero duplicates', () => {
    // Pass 1: Extraction generates initial items from transcript
    const pass1Items: ActionItem[] = [
      {
        id: 'item-1',
        task: 'Send revenue report',
        owner: 'Ravi',
        deadline: 'Friday',
        priority: 'high',
        status: 'open',
        confidence: 0.9,
        sourceQuote: 'Ravi will send the revenue report by Friday.',
      },
      {
        id: 'item-2',
        task: 'Book the client demo',
        owner: 'Priya',
        deadline: 'Tuesday',
        priority: 'medium',
        status: 'open',
        confidence: 0.88,
        sourceQuote: 'Priya, please book the client demo for next Tuesday.',
      },
    ];

    const stateAfterPass1 = mergeActionItems([], pass1Items);
    expect(stateAfterPass1).toHaveLength(2);

    // Pass 2: Second extraction pass on same transcript outputs items with new generated IDs
    const pass2Items: ActionItem[] = [
      {
        id: 'new-generated-id-1',
        task: 'Send revenue report',
        owner: 'Ravi',
        deadline: 'Friday',
        priority: 'high',
        status: 'open',
        confidence: 0.92,
        sourceQuote: 'Ravi will send the revenue report by Friday.',
      },
      {
        id: 'new-generated-id-2',
        task: 'Book the client demo',
        owner: 'Priya',
        deadline: 'Tuesday',
        priority: 'medium',
        status: 'open',
        confidence: 0.91,
        sourceQuote: 'Priya, please book the client demo for next Tuesday.',
      },
    ];

    const stateAfterPass2 = mergeActionItems(stateAfterPass1, pass2Items);
    expect(stateAfterPass2).toHaveLength(2);
    expect(stateAfterPass2.map((t) => t.task)).toEqual([
      'Send revenue report',
      'Book the client demo',
    ]);
  });
});

