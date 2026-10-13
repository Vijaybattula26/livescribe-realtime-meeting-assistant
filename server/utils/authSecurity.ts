import crypto from 'crypto';

interface FailedAttemptTracker {
  count: number;
  lockedUntil: number;
}

const failedAttempts = new Map<string, FailedAttemptTracker>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Constant-time password comparison to prevent timing attacks.
 * Never prints or logs the passwords.
 */
export function verifyPassword(provided: string | undefined | null, expected: string): boolean {
  if (!provided || !expected) {
    return false;
  }

  const bufProvided = Buffer.from(provided, 'utf8');
  const bufExpected = Buffer.from(expected, 'utf8');

  // If buffer lengths differ, hash both with SHA-256 and compare the hashes
  // so timing leaks cannot reveal string length.
  if (bufProvided.length !== bufExpected.length) {
    const hashP = crypto.createHash('sha256').update(bufProvided).digest();
    const hashE = crypto.createHash('sha256').update(bufExpected).digest();
    crypto.timingSafeEqual(hashP, hashE);
    return false;
  }

  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Checks if an IP is currently locked out due to repeated failed authentication attempts.
 */
export function isIpLockedOut(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record) return false;

  const now = Date.now();
  if (record.lockedUntil > now) {
    return true;
  }

  // Lockout expired, clean up
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    failedAttempts.delete(ip);
  }
  return false;
}

/**
 * Records a failed authentication attempt for an IP.
 */
export function recordFailedAuth(ip: string): { locked: boolean; remainingAttempts: number } {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    failedAttempts.set(ip, record);
    return { locked: true, remainingAttempts: 0 };
  }

  failedAttempts.set(ip, record);
  return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - record.count };
}

/**
 * Clears failed attempts upon successful authentication.
 */
export function recordSuccessfulAuth(ip: string): void {
  failedAttempts.delete(ip);
}

/**
 * Resets tracking state (for unit testing).
 */
export function resetAuthSecurityForTesting(): void {
  failedAttempts.clear();
}
