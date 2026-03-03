import { describe, it, expect, vi } from 'vitest';
import { InMemoryQueue } from '../../src/api/queue.js';
import type { SorSubmission } from '../../src/schemas/api-types.js';

function mockSubmission(puid = 'test-puid'): SorSubmission {
  return {
    decision_visibility: ['DECISION_VISIBILITY_CONTENT_REMOVED'],
    decision_ground: 'DECISION_GROUND_ILLEGAL_CONTENT',
    illegal_content_legal_ground: '§130 StGB',
    illegal_content_explanation: 'Hate speech',
    content_type: ['CONTENT_TYPE_TEXT'],
    category: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
    content_date: '2024-06-15',
    application_date: '2024-06-16',
    decision_facts: 'Content violated policies.',
    source_type: 'SOURCE_ARTICLE_16',
    automated_detection: 'No',
    automated_decision: 'AUTOMATED_DECISION_NOT_AUTOMATED',
    puid,
  } as SorSubmission;
}

describe('InMemoryQueue', () => {
  describe('enqueue', () => {
    it('adds an item and returns queued statement', async () => {
      const queue = new InMemoryQueue();
      const item = await queue.enqueue(mockSubmission());
      expect(item.id).toBeTruthy();
      expect(item.status).toBe('pending');
      expect(item.attempts).toBe(0);
      expect(item.addedAt).toBeInstanceOf(Date);
      expect(await queue.size()).toBe(1);
    });

    it('throws when queue is full', async () => {
      const queue = new InMemoryQueue({ maxSize: 2 });
      await queue.enqueue(mockSubmission('p1'));
      await queue.enqueue(mockSubmission('p2'));
      await expect(queue.enqueue(mockSubmission('p3'))).rejects.toThrow('Queue is full');
    });
  });

  describe('dequeue', () => {
    it('returns pending items up to limit', async () => {
      const queue = new InMemoryQueue();
      await queue.enqueue(mockSubmission('p1'));
      await queue.enqueue(mockSubmission('p2'));
      await queue.enqueue(mockSubmission('p3'));

      const items = await queue.dequeue(2);
      expect(items).toHaveLength(2);
    });

    it('returns empty array when no pending items', async () => {
      const queue = new InMemoryQueue();
      const items = await queue.dequeue(10);
      expect(items).toEqual([]);
    });

    it('skips items that exceeded max retries', async () => {
      const queue = new InMemoryQueue({ maxRetries: 2 });
      const item = await queue.enqueue(mockSubmission());

      // Fail twice to hit max retries
      await queue.markFailed(item.id, 'Error 1');
      await queue.markFailed(item.id, 'Error 2');

      const pending = await queue.dequeue(10);
      expect(pending).toHaveLength(0);
    });
  });

  describe('markCompleted', () => {
    it('removes the item from the queue', async () => {
      const queue = new InMemoryQueue();
      const item = await queue.enqueue(mockSubmission());
      await queue.markCompleted(item.id);
      expect(await queue.size()).toBe(0);
    });
  });

  describe('markFailed', () => {
    it('increments attempts and records error', async () => {
      const queue = new InMemoryQueue();
      const item = await queue.enqueue(mockSubmission());

      await queue.markFailed(item.id, 'API Error 503');
      const [pending] = await queue.dequeue(1);
      expect(pending.attempts).toBe(1);
      expect(pending.lastError).toBe('API Error 503');
      expect(pending.lastAttemptAt).toBeInstanceOf(Date);
      expect(pending.status).toBe('pending');
    });

    it('marks as failed when max retries exceeded', async () => {
      const queue = new InMemoryQueue({ maxRetries: 1 });
      const item = await queue.enqueue(mockSubmission());

      await queue.markFailed(item.id, 'Final error');

      // Item should now be 'failed', not returned by dequeue
      const pending = await queue.dequeue(10);
      expect(pending).toHaveLength(0);
      // But still counted in size
      expect(await queue.size()).toBe(1);
    });
  });

  describe('flush', () => {
    it('submits all pending items', async () => {
      const queue = new InMemoryQueue();
      await queue.enqueue(mockSubmission('p1'));
      await queue.enqueue(mockSubmission('p2'));

      const submitter = vi.fn().mockResolvedValue({ uuid: 'test', id: 1 });
      const result = await queue.flush(submitter);

      expect(result.submitted).toBe(2);
      expect(result.failed).toBe(0);
      expect(submitter).toHaveBeenCalledTimes(2);
      expect(await queue.size()).toBe(0);
    });

    it('handles partial failures during flush', async () => {
      const queue = new InMemoryQueue();
      await queue.enqueue(mockSubmission('p1'));
      await queue.enqueue(mockSubmission('p2'));

      const submitter = vi.fn()
        .mockResolvedValueOnce({ uuid: 'ok', id: 1 })
        .mockRejectedValueOnce(new Error('API down'));

      const result = await queue.flush(submitter);

      expect(result.submitted).toBe(1);
      expect(result.failed).toBe(1);
      expect(await queue.size()).toBe(1); // failed item remains
    });

    it('handles empty queue', async () => {
      const queue = new InMemoryQueue();
      const submitter = vi.fn();
      const result = await queue.flush(submitter);

      expect(result.submitted).toBe(0);
      expect(result.failed).toBe(0);
      expect(submitter).not.toHaveBeenCalled();
    });
  });

  describe('size', () => {
    it('returns total item count', async () => {
      const queue = new InMemoryQueue();
      expect(await queue.size()).toBe(0);

      await queue.enqueue(mockSubmission('p1'));
      await queue.enqueue(mockSubmission('p2'));
      expect(await queue.size()).toBe(2);
    });
  });
});
