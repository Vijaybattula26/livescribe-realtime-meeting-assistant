import { describe, it, expect } from 'vitest';
import { resolveRelativeDeadline } from '../server/utils/dateResolver.js';

describe('Date Resolver Unit Tests', () => {
  // Reference date: Tuesday, October 13, 2026, 10:00:00 UTC
  const fixedTuesday = new Date('2026-10-13T10:00:00.000Z');

  describe('Relative days and times', () => {
    it('resolves "today" to current date', () => {
      const res = resolveRelativeDeadline('today', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('today');
      expect(res.resolvedDate).toBeDefined();
      expect(res.resolvedDate?.startsWith('2026-10-13')).toBe(true);
    });

    it('resolves "tomorrow" to next day', () => {
      const res = resolveRelativeDeadline('tomorrow', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('tomorrow');
      expect(res.resolvedDate?.startsWith('2026-10-14')).toBe(true);
    });

    it('resolves "tomorrow evening" to 18:00 on next day', () => {
      const res = resolveRelativeDeadline('tomorrow evening', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('tomorrow evening');
      expect(res.resolvedDate?.startsWith('2026-10-14T18:00:00')).toBe(true);
    });

    it('resolves "tomorrow morning" to 09:00 on next day', () => {
      const res = resolveRelativeDeadline('tomorrow morning', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('tomorrow morning');
      expect(res.resolvedDate?.startsWith('2026-10-14T09:00:00')).toBe(true);
    });

    it('resolves "day after tomorrow" to +2 days', () => {
      const res = resolveRelativeDeadline('day after tomorrow', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('day after tomorrow');
      expect(res.resolvedDate?.startsWith('2026-10-15')).toBe(true);
    });

    it('resolves "tonight" to 20:00 today', () => {
      const res = resolveRelativeDeadline('tonight', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('tonight');
      expect(res.resolvedDate?.startsWith('2026-10-13T20:00:00')).toBe(true);
    });
  });

  describe('Day of week resolution', () => {
    it('resolves "Friday" from a Tuesday to upcoming Friday (+3 days)', () => {
      const res = resolveRelativeDeadline('Friday', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('Friday');
      expect(res.resolvedDate?.startsWith('2026-10-16')).toBe(true);
    });

    it('resolves "next Tuesday" to +7 days', () => {
      const res = resolveRelativeDeadline('next Tuesday', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('next Tuesday');
      expect(res.resolvedDate?.startsWith('2026-10-20')).toBe(true);
    });

    it('resolves "by Thursday" to upcoming Thursday (+2 days)', () => {
      const res = resolveRelativeDeadline('by Thursday', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('by Thursday');
      expect(res.resolvedDate?.startsWith('2026-10-15')).toBe(true);
    });
  });

  describe('Week boundaries', () => {
    // Reference date: Friday, October 16, 2026
    const fixedFriday = new Date('2026-10-16T15:00:00.000Z');

    it('resolves "Friday" on Friday to today', () => {
      const res = resolveRelativeDeadline('Friday', fixedFriday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-10-16')).toBe(true);
    });

    it('resolves "Monday" on Friday across the weekend to next Monday (+3 days)', () => {
      const res = resolveRelativeDeadline('Monday', fixedFriday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-10-19')).toBe(true);
    });

    it('resolves "next Friday" on Friday to +7 days', () => {
      const res = resolveRelativeDeadline('next Friday', fixedFriday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-10-23')).toBe(true);
    });

    it('resolves "end of week" on Friday to current Friday', () => {
      const res = resolveRelativeDeadline('end of week', fixedFriday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-10-16')).toBe(true);
    });
  });

  describe('Month ends and boundaries', () => {
    // Reference date: Saturday, October 31, 2026
    const fixedMonthEnd = new Date('2026-10-31T11:00:00.000Z');

    it('resolves "end of month" to the last day of current month (Oct 31)', () => {
      const res = resolveRelativeDeadline('end of month', fixedTuesday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-10-31')).toBe(true);
    });

    it('resolves "tomorrow" on October 31 to November 1', () => {
      const res = resolveRelativeDeadline('tomorrow', fixedMonthEnd, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-11-01')).toBe(true);
    });

    it('resolves "November" to the 1st of November', () => {
      const res = resolveRelativeDeadline('November', fixedTuesday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-11-01')).toBe(true);
    });

    it('resolves "November 15" to 2026-11-15', () => {
      const res = resolveRelativeDeadline('November 15', fixedTuesday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-11-15')).toBe(true);
    });

    it('resolves "end of November" to 2026-11-30', () => {
      const res = resolveRelativeDeadline('end of November', fixedTuesday, 'UTC');
      expect(res.resolvedDate?.startsWith('2026-11-30')).toBe(true);
    });
  });

  describe('Edge cases and unparseable inputs', () => {
    it('handles null gracefully', () => {
      const res = resolveRelativeDeadline(null, fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBeNull();
      expect(res.resolvedDate).toBeNull();
    });

    it('handles empty string gracefully', () => {
      const res = resolveRelativeDeadline('', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBeNull();
      expect(res.resolvedDate).toBeNull();
    });

    it('preserves unparseable phrases without throwing', () => {
      const res = resolveRelativeDeadline('when ready', fixedTuesday, 'UTC');
      expect(res.originalPhrase).toBe('when ready');
      expect(res.resolvedDate).toBeNull();
    });
  });
});
