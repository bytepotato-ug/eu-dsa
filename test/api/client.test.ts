import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransparencyDatabaseClient } from '../../src/api/client.js';
import {
  DsaValidationError,
  DsaApiError,
  DsaAuthError,
  DsaPuidConflictError,
  DsaNetworkError,
} from '../../src/api/errors.js';
import type { SorSubmission } from '../../src/schemas/api-types.js';

function validSubmission(overrides: Partial<SorSubmission> = {}): SorSubmission {
  return {
    decision_visibility: ['DECISION_VISIBILITY_CONTENT_REMOVED'],
    decision_ground: 'DECISION_GROUND_ILLEGAL_CONTENT',
    illegal_content_legal_ground: '§130 StGB',
    illegal_content_explanation: 'Incitement to hatred',
    content_type: ['CONTENT_TYPE_TEXT'],
    category: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
    content_date: '2024-06-15',
    application_date: '2024-06-16',
    decision_facts: 'Content contained hate speech.',
    source_type: 'SOURCE_ARTICLE_16',
    automated_detection: 'No',
    automated_decision: 'AUTOMATED_DECISION_NOT_AUTOMATED',
    puid: 'test-puid-123',
    ...overrides,
  } as SorSubmission;
}

function createMockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    status,
    headers: new Headers({
      'content-type': 'application/json',
      ...headers,
    }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function createClient(fetchFn: typeof fetch) {
  return new TransparencyDatabaseClient({
    token: 'test-token',
    fetch: fetchFn,
    retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, retryableStatuses: [] },
  });
}

describe('TransparencyDatabaseClient', () => {
  describe('submitStatement', () => {
    it('submits a valid SoR and returns the response', async () => {
      const responseBody = {
        ...validSubmission(),
        id: 100000000001,
        uuid: 'abc-123',
        created_at: '2024-06-16 10:00:00',
        platform_name: 'Test Platform',
        permalink: 'https://transparency.dsa.ec.europa.eu/statement/100000000001',
        self: 'https://transparency.dsa.ec.europa.eu/api/v1/statement/100000000001',
      };

      const fetchFn = createMockFetch(201, responseBody);
      const client = createClient(fetchFn);

      const result = await client.submitStatement(validSubmission());
      expect(result.uuid).toBe('abc-123');
      expect(result.id).toBe(100000000001);

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/statement'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Accept': 'application/json',
          }),
        }),
      );
    });

    it('validates the submission before sending', async () => {
      const fetchFn = createMockFetch(201, {});
      const client = createClient(fetchFn);

      await expect(client.submitStatement({} as SorSubmission)).rejects.toThrow(DsaValidationError);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('throws DsaAuthError on 401', async () => {
      const fetchFn = createMockFetch(401, { message: 'Unauthenticated.' });
      const client = createClient(fetchFn);

      await expect(client.submitStatement(validSubmission())).rejects.toThrow(DsaAuthError);
    });

    it('throws DsaApiError on 422 validation error', async () => {
      const fetchFn = createMockFetch(422, {
        message: 'The given data was invalid.',
        errors: { puid: ['The puid field is required.'] },
      });
      const client = createClient(fetchFn);

      await expect(client.submitStatement(validSubmission())).rejects.toThrow(DsaApiError);
    });

    it('throws DsaPuidConflictError on PUID conflict', async () => {
      const fetchFn = createMockFetch(422, {
        message: 'The identifier given is not unique within this platform.',
        errors: { puid: ['The identifier given is not unique within this platform.'] },
        existing: { puid: 'test-puid-123' },
      });
      const client = createClient(fetchFn);

      await expect(client.submitStatement(validSubmission())).rejects.toThrow(DsaPuidConflictError);
    });
  });

  describe('submitStatements (batch)', () => {
    it('submits a batch of SoRs', async () => {
      const responseBody = {
        statements: [
          { ...validSubmission({ puid: 'puid-1' }), uuid: 'uuid-1', id: 1, created_at: '2024-01-01 00:00:00', platform_name: 'Test', permalink: '', self: '' },
          { ...validSubmission({ puid: 'puid-2' }), uuid: 'uuid-2', id: 2, created_at: '2024-01-01 00:00:00', platform_name: 'Test', permalink: '', self: '' },
        ],
      };

      const fetchFn = createMockFetch(201, responseBody);
      const client = createClient(fetchFn);

      const result = await client.submitStatements([
        validSubmission({ puid: 'puid-1' }),
        validSubmission({ puid: 'puid-2' }),
      ]);

      expect(result.statements).toHaveLength(2);
    });

    it('returns empty array for empty input', async () => {
      const fetchFn = createMockFetch(201, {});
      const client = createClient(fetchFn);

      const result = await client.submitStatements([]);
      expect(result.statements).toHaveLength(0);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('validates all submissions before sending', async () => {
      const fetchFn = createMockFetch(201, {});
      const client = createClient(fetchFn);

      await expect(client.submitStatements([
        validSubmission(),
        {} as SorSubmission,
      ])).rejects.toThrow(DsaValidationError);

      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('checkPuid', () => {
    it('returns exists: true when PUID is found (302)', async () => {
      const fetchFn = createMockFetch(302, { message: 'statement of reason found', puid: 'test-123' });
      const client = createClient(fetchFn);

      const result = await client.checkPuid('test-123');
      expect(result.exists).toBe(true);
      expect(result.puid).toBe('test-123');
    });

    it('returns exists: false when PUID is not found (404)', async () => {
      const fetchFn = createMockFetch(404, { message: 'statement of reason not found', puid: 'test-123' });
      const client = createClient(fetchFn);

      const result = await client.checkPuid('test-123');
      expect(result.exists).toBe(false);
    });
  });

  describe('ping', () => {
    it('returns ok: true on success', async () => {
      const fetchFn = createMockFetch(200, { you_say: 'ping', i_say: 'pong' });
      const client = createClient(fetchFn);

      const result = await client.ping();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns ok: false on failure', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const client = createClient(fetchFn);

      const result = await client.ping();
      expect(result.ok).toBe(false);
    });
  });

  describe('interceptors', () => {
    it('calls request interceptor before sending', async () => {
      const requestInterceptor = vi.fn((ctx) => ctx);
      const fetchFn = createMockFetch(201, { uuid: 'test', id: 1, created_at: '', platform_name: '', permalink: '', self: '' });

      const client = new TransparencyDatabaseClient({
        token: 'test-token',
        fetch: fetchFn,
        retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, retryableStatuses: [] },
        interceptors: { request: [requestInterceptor] },
      });

      await client.submitStatement(validSubmission());
      expect(requestInterceptor).toHaveBeenCalledOnce();
      expect(requestInterceptor.mock.calls[0][0]).toHaveProperty('url');
      expect(requestInterceptor.mock.calls[0][0]).toHaveProperty('method', 'POST');
    });

    it('calls response interceptor after receiving', async () => {
      const responseInterceptor = vi.fn();
      const fetchFn = createMockFetch(201, { uuid: 'test', id: 1, created_at: '', platform_name: '', permalink: '', self: '' });

      const client = new TransparencyDatabaseClient({
        token: 'test-token',
        fetch: fetchFn,
        retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, retryableStatuses: [] },
        interceptors: { response: [responseInterceptor] },
      });

      await client.submitStatement(validSubmission());
      expect(responseInterceptor).toHaveBeenCalledOnce();
      expect(responseInterceptor.mock.calls[0][0]).toHaveProperty('statusCode', 201);
      expect(responseInterceptor.mock.calls[0][0]).toHaveProperty('durationMs');
    });
  });

  describe('timeout handling', () => {
    it('throws DsaNetworkError on timeout', async () => {
      const fetchFn = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      });

      const client = new TransparencyDatabaseClient({
        token: 'test-token',
        fetch: fetchFn,
        timeoutMs: 100,
        retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, retryableStatuses: [] },
      });

      await expect(client.submitStatement(validSubmission())).rejects.toThrow(DsaNetworkError);
    });
  });

  describe('queue integration', () => {
    it('submitOrQueue falls back to queue on retryable error', async () => {
      const fetchFn = createMockFetch(503, { message: 'Service unavailable' });
      const client = createClient(fetchFn);

      const { InMemoryQueue } = await import('../../src/api/queue.js');
      const queue = new InMemoryQueue();
      client.setQueue(queue);

      const result = await client.submitOrQueue(validSubmission());
      expect(result).toHaveProperty('status', 'pending');
      expect(await queue.size()).toBe(1);
    });
  });
});
