import { describe, it, expect } from 'vitest';
import {
  DsaToolkitError,
  DsaValidationError,
  DsaNetworkError,
  DsaApiError,
  DsaAuthError,
  DsaPuidConflictError,
  DsaRateLimitError,
  DsaBatchError,
} from '../../src/api/errors.js';

describe('Error hierarchy', () => {
  describe('DsaToolkitError', () => {
    it('has name, message, and code', () => {
      const err = new DsaToolkitError('test', 'TEST_CODE');
      expect(err.name).toBe('DsaToolkitError');
      expect(err.message).toBe('test');
      expect(err.code).toBe('TEST_CODE');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('DsaValidationError', () => {
    it('stores field errors', () => {
      const err = new DsaValidationError('Validation failed', {
        puid: ['puid is required'],
        decision_ground: ['decision_ground is required'],
      });
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.fieldErrors.puid).toEqual(['puid is required']);
      expect(err).toBeInstanceOf(DsaToolkitError);
    });
  });

  describe('DsaNetworkError', () => {
    it('stores cause', () => {
      const cause = new Error('ECONNREFUSED');
      const err = new DsaNetworkError('Connection failed', cause);
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.cause).toBe(cause);
    });

    it('works without cause', () => {
      const err = new DsaNetworkError('Timeout');
      expect(err.cause).toBeUndefined();
    });
  });

  describe('DsaApiError', () => {
    it('has statusCode and response', () => {
      const err = new DsaApiError('Server Error', 500, { message: 'Internal error' });
      expect(err.code).toBe('API_ERROR_500');
      expect(err.statusCode).toBe(500);
      expect(err.response?.message).toBe('Internal error');
    });

    it('isRetryable for 5xx and 408/429', () => {
      expect(new DsaApiError('', 408).isRetryable).toBe(true);
      expect(new DsaApiError('', 429).isRetryable).toBe(true);
      expect(new DsaApiError('', 500).isRetryable).toBe(true);
      expect(new DsaApiError('', 502).isRetryable).toBe(true);
      expect(new DsaApiError('', 503).isRetryable).toBe(true);
      expect(new DsaApiError('', 504).isRetryable).toBe(true);
      expect(new DsaApiError('', 404).isRetryable).toBe(false);
      expect(new DsaApiError('', 422).isRetryable).toBe(false);
    });

    it('isRateLimited only for 429', () => {
      expect(new DsaApiError('', 429).isRateLimited).toBe(true);
      expect(new DsaApiError('', 503).isRateLimited).toBe(false);
    });

    it('extracts fieldErrors from response', () => {
      const err = new DsaApiError('Validation', 422, {
        message: 'Invalid',
        errors: { puid: ['required'] },
      });
      expect(err.fieldErrors).toEqual({ puid: ['required'] });
    });

    it('returns undefined fieldErrors when no errors in response', () => {
      const err = new DsaApiError('Error', 500, { message: 'crash' });
      expect(err.fieldErrors).toBeUndefined();
    });
  });

  describe('DsaAuthError', () => {
    it('is a DsaApiError with 401/403', () => {
      const err = new DsaAuthError('Unauthorized', 401);
      expect(err.name).toBe('DsaAuthError');
      expect(err.statusCode).toBe(401);
      expect(err).toBeInstanceOf(DsaApiError);
      expect(err).toBeInstanceOf(DsaToolkitError);
    });
  });

  describe('DsaPuidConflictError', () => {
    it('stores the conflicting puid', () => {
      const err = new DsaPuidConflictError('my-puid-123', { existing: { puid: 'my-puid-123' } });
      expect(err.name).toBe('DsaPuidConflictError');
      expect(err.puid).toBe('my-puid-123');
      expect(err.statusCode).toBe(422);
      expect(err.message).toContain('my-puid-123');
    });
  });

  describe('DsaRateLimitError', () => {
    it('stores retryAfterMs', () => {
      const err = new DsaRateLimitError(60000);
      expect(err.name).toBe('DsaRateLimitError');
      expect(err.retryAfterMs).toBe(60000);
      expect(err.statusCode).toBe(429);
      expect(err.isRateLimited).toBe(true);
    });

    it('stores rate limit info', () => {
      const info = { limit: 100, remaining: 0, resetAt: new Date() };
      const err = new DsaRateLimitError(5000, info);
      expect(err.rateLimitInfo).toBe(info);
    });
  });

  describe('DsaBatchError', () => {
    it('stores succeeded and failed arrays', () => {
      const err = new DsaBatchError(
        [{ index: 0, uuid: 'abc', puid: 'p1' }],
        [{ index: 1, errors: { puid: ['duplicate'] } }],
      );
      expect(err.name).toBe('DsaBatchError');
      expect(err.code).toBe('BATCH_ERROR');
      expect(err.succeeded).toHaveLength(1);
      expect(err.failed).toHaveLength(1);
      expect(err.message).toContain('1 succeeded');
      expect(err.message).toContain('1 failed');
    });
  });
});
