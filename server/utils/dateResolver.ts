/**
 * Date Resolver for LiveScribe
 * Resolves spoken relative deadline phrases (e.g. "Friday", "next Tuesday",
 * "tomorrow evening", "end of month") against a reference date and user timezone in code.
 */

export interface ResolvedDeadline {
  originalPhrase: string | null;
  resolvedDate: string | null; // ISO 8601 string or null
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const MONTH_ABBR = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

/**
 * Gets local year, month, day, hours, minutes from a date in a specified IANA timezone.
 */
function getZonedParts(date: Date, timezone: string): {
  year: number;
  month: number; // 0-indexed
  day: number;
  dayOfWeek: number; // 0=Sunday
  hours: number;
  minutes: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth();
    let day = date.getUTCDate();
    let hours = date.getUTCHours();
    let minutes = date.getUTCMinutes();
    let weekdayStr = 'Sun';

    for (const part of parts) {
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10) - 1;
      if (part.type === 'day') day = parseInt(part.value, 10);
      if (part.type === 'hour') hours = parseInt(part.value, 10) % 24;
      if (part.type === 'minute') minutes = parseInt(part.value, 10);
      if (part.type === 'weekday') weekdayStr = part.value;
    }

    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = shortDays.indexOf(weekdayStr);

    return {
      year,
      month,
      day,
      dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : date.getUTCDay(),
      hours,
      minutes,
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      dayOfWeek: date.getDay(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
    };
  }
}

/**
 * Creates an ISO date string for a specific year, month, day, hour, minute in a target timezone.
 */
function createZonedIso(
  year: number,
  month: number,
  day: number,
  hour = 17,
  minute = 0,
  timezone = 'UTC'
): string {
  if (!timezone || timezone.toUpperCase() === 'UTC' || timezone.toUpperCase() === 'GMT') {
    return new Date(Date.UTC(year, month, day, hour, minute, 0)).toISOString();
  }

  try {
    // For specific IANA timezones, calculate the offset from UTC
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    const targetDate = new Date(dateStr);
    
    // Format in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    
    const parts = formatter.formatToParts(targetDate);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value; // e.g. "GMT+5:30" or "GMT-4"
    
    if (tzPart) {
      const match = tzPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const offsetHours = parseInt(match[2], 10);
        const offsetMinutes = match[3] ? parseInt(match[3], 10) : 0;
        const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;
        
        // UTC time = local target time - offset
        const localUtc = Date.UTC(year, month, day, hour, minute, 0);
        return new Date(localUtc - totalOffsetMs).toISOString();
      }
    }

    return new Date(Date.UTC(year, month, day, hour, minute, 0)).toISOString();
  } catch {
    return new Date(Date.UTC(year, month, day, hour, minute, 0)).toISOString();
  }
}

/**
 * Resolves a spoken relative deadline phrase against a reference date and timezone.
 */
export function resolveRelativeDeadline(
  phrase: string | null | undefined,
  referenceDateInput: Date | string = new Date(),
  timezone = 'UTC'
): ResolvedDeadline {
  if (!phrase || typeof phrase !== 'string') {
    return { originalPhrase: null, resolvedDate: null };
  }

  const clean = phrase.trim();
  if (!clean) {
    return { originalPhrase: null, resolvedDate: null };
  }

  const lower = clean.toLowerCase();
  const refDate = typeof referenceDateInput === 'string' ? new Date(referenceDateInput) : referenceDateInput;
  if (isNaN(refDate.getTime())) {
    return { originalPhrase: clean, resolvedDate: null };
  }

  const { year, month, day, dayOfWeek } = getZonedParts(refDate, timezone);

  // Time of day hint
  let targetHour = 17; // default 5:00 PM close of business
  const targetMinute = 0;

  if (lower.includes('morning')) {
    targetHour = 9;
  } else if (lower.includes('afternoon')) {
    targetHour = 14;
  } else if (lower.includes('evening') || lower.includes('tonight')) {
    targetHour = 18;
  } else if (lower.includes('end of day') || lower.includes('eod') || lower.includes('cob')) {
    targetHour = 17;
  } else if (lower.includes('noon')) {
    targetHour = 12;
  }

  // 1. "today" / "tonight" / "by end of day today"
  if (/\b(today|tonight)\b/.test(lower)) {
    const hr = lower.includes('tonight') ? 20 : targetHour;
    return {
      originalPhrase: clean,
      resolvedDate: createZonedIso(year, month, day, hr, targetMinute, timezone),
    };
  }

  // 2. "day after tomorrow"
  if (/\bday after tomorrow\b/.test(lower)) {
    const target = new Date(Date.UTC(year, month, day + 2));
    return {
      originalPhrase: clean,
      resolvedDate: createZonedIso(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        target.getUTCDate(),
        targetHour,
        targetMinute,
        timezone
      ),
    };
  }

  // 3. "tomorrow" / "tomorrow evening" / "tomorrow morning"
  if (/\btomorrow\b/.test(lower)) {
    const target = new Date(Date.UTC(year, month, day + 1));
    return {
      originalPhrase: clean,
      resolvedDate: createZonedIso(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        target.getUTCDate(),
        targetHour,
        targetMinute,
        timezone
      ),
    };
  }

  // 4. "end of week" / "end of the week" / "by end of week"
  if (/\bend of (the )?week\b/.test(lower)) {
    // Upcoming Friday (day 5)
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0) daysUntilFriday = 0; // if today is Friday, today end of day
    const target = new Date(Date.UTC(year, month, day + daysUntilFriday));
    return {
      originalPhrase: clean,
      resolvedDate: createZonedIso(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        target.getUTCDate(),
        17,
        0,
        timezone
      ),
    };
  }

  // 5. "end of month" / "end of the month" / "by end of month"
  if (/\bend of (the )?month\b/.test(lower)) {
    // Day 0 of next month is the last day of this month
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    return {
      originalPhrase: clean,
      resolvedDate: createZonedIso(
        lastDayOfMonth.getUTCFullYear(),
        lastDayOfMonth.getUTCMonth(),
        lastDayOfMonth.getUTCDate(),
        17,
        0,
        timezone
      ),
    };
  }

  // 6. "next week"
  if (/\bnext week\b/.test(lower)) {
    // Next Monday
    const daysUntilNextMonday = ((1 - dayOfWeek + 7) % 7) || 7;
    const target = new Date(Date.UTC(year, month, day + daysUntilNextMonday));
    return {
      originalPhrase: clean,
      resolvedDate: createZonedIso(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        target.getUTCDate(),
        9,
        0,
        timezone
      ),
    };
  }

  // 7. Days of week: "Friday", "next Tuesday", "this Wednesday", "by Thursday", "on Monday"
  for (let targetDayIdx = 0; targetDayIdx < DAY_NAMES.length; targetDayIdx++) {
    const dayName = DAY_NAMES[targetDayIdx];
    const regex = new RegExp(`\\b(next\\s+|this\\s+|by\\s+|on\\s+)?${dayName}\\b`, 'i');
    if (regex.test(lower)) {
      const isExplicitNext = /\bnext\s+/i.test(lower);
      let diff = targetDayIdx - dayOfWeek;

      if (isExplicitNext) {
        // "next Tuesday": if today is Tuesday, +7 days. If today is Monday, next Tuesday is next week's Tuesday (+8 days)
        diff = diff <= 0 ? diff + 7 : diff + 7;
      } else {
        // "Friday" or "this Friday": upcoming instance.
        // If today is Friday, it means today.
        if (diff < 0) {
          diff += 7;
        }
      }

      const target = new Date(Date.UTC(year, month, day + diff));
      return {
        originalPhrase: clean,
        resolvedDate: createZonedIso(
          target.getUTCFullYear(),
          target.getUTCMonth(),
          target.getUTCDate(),
          targetHour,
          targetMinute,
          timezone
        ),
      };
    }
  }

  // 8. Named months: "in November", "by November", "November 15", "15th November", "end of November"
  for (let mIdx = 0; mIdx < MONTH_NAMES.length; mIdx++) {
    const mName = MONTH_NAMES[mIdx];
    const mAbbr = MONTH_ABBR[mIdx];
    const mRegex = new RegExp(`\\b(${mName}|${mAbbr})\\b`, 'i');
    if (mRegex.test(lower)) {
      // Check for specific day number: e.g. "November 15", "15th November"
      const dayMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
      let targetYear = year;
      if (mIdx < month) {
        // Month has already passed this year, refer to next year
        targetYear = year + 1;
      }

      let targetDay = 1;
      if (dayMatch) {
        targetDay = parseInt(dayMatch[1], 10);
      } else if (lower.includes('end of')) {
        const lastDay = new Date(Date.UTC(targetYear, mIdx + 1, 0)).getUTCDate();
        targetDay = lastDay;
      }

      return {
        originalPhrase: clean,
        resolvedDate: createZonedIso(targetYear, mIdx, targetDay, targetHour, targetMinute, timezone),
      };
    }
  }

  // 9. Standard ISO or YYYY-MM-DD date passed directly
  const directDate = new Date(clean);
  if (!isNaN(directDate.getTime()) && directDate.getFullYear() > 2000) {
    return {
      originalPhrase: clean,
      resolvedDate: directDate.toISOString(),
    };
  }

  // Fallback: original phrase preserved, date unresolved
  return {
    originalPhrase: clean,
    resolvedDate: null,
  };
}
