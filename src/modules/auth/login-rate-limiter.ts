import { HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

/**
 * In-memory brute force rate limiter for user authentication endpoints.
 * Limits failed login attempts per key (IP address or email) within a window.
 */
export class LoginRateLimiter {
  private readonly attempts = new Map<string, RateLimitEntry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly blockDurationMs: number;

  constructor(maxAttempts = 5, windowMs = 5 * 60 * 1000, blockDurationMs = 5 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.blockDurationMs = blockDurationMs;

    // Periodic cleanup of expired entries every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000).unref();
  }

  /**
   * Checks if an identifier is currently rate-limited.
   * Throws 429 TooManyRequests if blocked.
   */
  check(key: string): void {
    if (!key) return;
    const entry = this.attempts.get(key);
    if (!entry) return;

    const now = Date.now();
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const waitSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      throw new HttpException(
        `Too many failed login attempts. Please try again in ${waitSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Records a failed attempt for an identifier.
   */
  recordFailure(key: string): void {
    if (!key) return;
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now - entry.firstAttemptAt > this.windowMs) {
      this.attempts.set(key, { attempts: 1, firstAttemptAt: now });
      return;
    }

    entry.attempts += 1;
    if (entry.attempts >= this.maxAttempts) {
      entry.blockedUntil = now + this.blockDurationMs;
    }
  }

  /**
   * Resets the attempt counter on successful login.
   */
  reset(key: string): void {
    if (!key) return;
    this.attempts.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (
        (!entry.blockedUntil || entry.blockedUntil <= now) &&
        now - entry.firstAttemptAt > this.windowMs
      ) {
        this.attempts.delete(key);
      }
    }
  }
}

export const globalLoginRateLimiter = new LoginRateLimiter();
