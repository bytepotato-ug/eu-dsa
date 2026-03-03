/**
 * Retry logic with exponential backoff and jitter.
 */

import { DsaApiError } from './errors.js';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
  onRetry?: (attempt: number, error: DsaApiError, delayMs: number) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * config.baseDelayMs;
  return Math.min(exponential + jitter, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt >= config.maxAttempts) break;

      const isRetryable = error instanceof DsaApiError
        && config.retryableStatuses.includes(error.statusCode);

      if (!isRetryable) throw error;

      let delayMs = calculateDelay(attempt, config);

      // Respect Retry-After on 429
      if (error instanceof DsaApiError && error.isRateLimited && error.rateLimitInfo?.resetAt) {
        const retryAfter = error.rateLimitInfo.resetAt.getTime() - Date.now();
        if (retryAfter > 0) {
          delayMs = Math.min(retryAfter, config.maxDelayMs);
        }
      }

      config.onRetry?.(attempt, error, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
