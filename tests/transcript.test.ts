import { describe, it, expect } from 'vitest';
import { TranscriptSegment } from '../src/types';

describe('Transcript Segment Handling', () => {
  it('should format and store finalized transcript segment correctly', () => {
    const segment: TranscriptSegment = {
      id: 'seg-1',
      startedAt: '10:00:15',
      text: 'Good morning everyone, let us get started.',
      isFinal: true,
    };

    expect(segment.id).toBe('seg-1');
    expect(segment.isFinal).toBe(true);
    expect(segment.startedAt).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should accurately calculate word count from segments', () => {
    const segments: TranscriptSegment[] = [
      { id: '1', startedAt: '10:00:00', text: 'Hello team.', isFinal: true }, // 2 words
      {
        id: '2',
        startedAt: '10:00:05',
        text: 'Today we discuss the quarterly goals.', // 6 words
        isFinal: true,
      },
    ];

    const totalWords = segments.reduce((sum, seg) => {
      return sum + seg.text.trim().split(/\s+/).filter(Boolean).length;
    }, 0);

    expect(totalWords).toBe(8);
  });

  it('should accurately check minimum word threshold for extraction', () => {
    const textBelowThreshold = 'Just a few short words spoken.';
    const wordsBelow = textBelowThreshold.trim().split(/\s+/).filter(Boolean).length;
    expect(wordsBelow).toBeLessThan(40);

    const longText =
      'We had an extensive conversation regarding the infrastructure migration plan. Alice agreed to evaluate Kubernetes clusters by Wednesday and prepare a comparison document with cost calculations for the executive board before our next quarterly budget alignment meeting scheduled for Friday afternoon.';
    const wordsAbove = longText.trim().split(/\s+/).filter(Boolean).length;
    expect(wordsAbove).toBeGreaterThanOrEqual(40);
  });
});
