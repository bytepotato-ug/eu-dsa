import { describe, it, expect, vi } from 'vitest';
import { withRetry, DEFAULT_RETRY_CONFIG } from '../../src/api/retry.js';
import { DsaApiError } from '../../src/api/errors.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { ...DEFAULT_RETRY_CONFIG, maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries on retryable status codes', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new DsaApiError('Server Error', 503))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableStatuses: [503],
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-retryable status codes', async () => {
    const fn = vi.fn().mockRejectedValue(new DsaApiError('Not Found', 404));

    await expect(withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableStatuses: [503],
    })).rejects.toThrow('Not Found');

    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not retry non-DsaApiError errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Random crash'));

    await expect(withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableStatuses: [503],
    })).rejects.toThrow('Random crash');

    expect(fn).toHaveBeenCalledOnce();
  });

  it('throws after max attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new DsaApiError('Server Error', 503));

    await expect(withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableStatuses: [503],
    })).rejects.toThrow('Server Error');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new DsaApiError('Error', 502))
      .mockResolvedValue('ok');

    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      retryableStatuses: [502],
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry.mock.calls[0][0]).toBe(1); // attempt number
    expect(onRetry.mock.calls[0][1]).toBeInstanceOf(DsaApiError);
  });

  it('uses default config when none provided', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
  });

  it('retries all default retryable statuses', async () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      const fn = vi.fn()
        .mockRejectedValueOnce(new DsaApiError('Error', status))
        .mockResolvedValue('ok');

      const result = await withRetry(fn, {
        ...DEFAULT_RETRY_CONFIG,
        baseDelayMs: 0,
        maxDelayMs: 0,
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });
});
