import { config } from '../config.js';
import { debugLog } from './logger.js';

interface DailyUsage {
  dateStr: string; // YYYY-MM-DD
  liveMinutesUsed: number;
  extractionCallsUsed: number;
}

class QuotaManager {
  private usage: DailyUsage = {
    dateStr: this.getTodayDateStr(),
    liveMinutesUsed: 0,
    extractionCallsUsed: 0,
  };

  private getTodayDateStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private resetIfNewDay() {
    const today = this.getTodayDateStr();
    if (this.usage.dateStr !== today) {
      debugLog(`[Quota] Resetting daily quota counters for new day: ${today}`);
      this.usage = {
        dateStr: today,
        liveMinutesUsed: 0,
        extractionCallsUsed: 0,
      };
    }
  }

  /**
   * Check if live session quota is available.
   */
  public canStartLiveSession(): { allowed: boolean; reason?: string } {
    this.resetIfNewDay();
    if (this.usage.liveMinutesUsed >= config.dailyLiveSessionMinutesLimit) {
      return {
        allowed: false,
        reason: `Daily live session limit reached (${config.dailyLiveSessionMinutesLimit} minutes/day). Quota will reset tomorrow.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Record live session duration in milliseconds.
   */
  public recordLiveSessionDuration(durationMs: number) {
    this.resetIfNewDay();
    const minutes = durationMs / (1000 * 60);
    this.usage.liveMinutesUsed += minutes;
    debugLog(`[Quota] Recorded ${minutes.toFixed(2)} live minutes. Total today: ${this.usage.liveMinutesUsed.toFixed(2)}/${config.dailyLiveSessionMinutesLimit}`);
  }

  /**
   * Check and record an extraction call.
   */
  public checkAndRecordExtraction(): { allowed: boolean; reason?: string } {
    this.resetIfNewDay();
    if (this.usage.extractionCallsUsed >= config.dailyExtractionCallsLimit) {
      return {
        allowed: false,
        reason: `Daily extraction limit reached (${config.dailyExtractionCallsLimit} requests/day). Quota will reset tomorrow.`,
      };
    }
    this.usage.extractionCallsUsed += 1;
    debugLog(`[Quota] Recorded extraction call. Total today: ${this.usage.extractionCallsUsed}/${config.dailyExtractionCallsLimit}`);
    return { allowed: true };
  }

  /**
   * Get current usage statistics.
   */
  public getStatus() {
    this.resetIfNewDay();
    return {
      date: this.usage.dateStr,
      liveMinutesUsed: Math.round(this.usage.liveMinutesUsed * 10) / 10,
      liveMinutesLimit: config.dailyLiveSessionMinutesLimit,
      extractionCallsUsed: this.usage.extractionCallsUsed,
      extractionCallsLimit: config.dailyExtractionCallsLimit,
    };
  }

  /**
   * Reset usage counters (useful for unit testing).
   */
  public resetForTesting() {
    this.usage = {
      dateStr: this.getTodayDateStr(),
      liveMinutesUsed: 0,
      extractionCallsUsed: 0,
    };
  }
}

export const quotaManager = new QuotaManager();
