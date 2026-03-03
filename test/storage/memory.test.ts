import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../../src/storage/memory.js';
import { NoticeState, type Notice } from '../../src/notice/types.js';
import { AppealState, type Appeal } from '../../src/appeals/types.js';
import type { QueuedStatement } from '../../src/api/queue.js';

function makeNotice(overrides: Partial<Notice> = {}): Notice {
  return {
    id: crypto.randomUUID(),
    source: { type: 'SOURCE_ARTICLE_16', reporterId: 'r1', isTrustedFlagger: false },
    content: { contentId: 'post-1', contentType: 'text' },
    classification: { platformCategory: 'spam' },
    state: NoticeState.RECEIVED,
    timestamps: { received: new Date() },
    priority: 50,
    metadata: {},
    ...overrides,
  };
}

function makeAppeal(overrides: Partial<Appeal> = {}): Appeal {
  return {
    id: crypto.randomUUID(),
    appellantId: 'user-1',
    originalDecision: 'Content removed',
    appealText: 'I disagree',
    state: AppealState.SUBMITTED,
    timestamps: { submitted: new Date(), windowExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
    metadata: {},
    ...overrides,
  };
}

describe('InMemoryStorage', () => {
  describe('notices', () => {
    it('saves and retrieves a notice', async () => {
      const store = createInMemoryStorage();
      const notice = makeNotice({ id: 'n-1' });

      await store.notices.save(notice);
      const found = await store.notices.findById('n-1');
      expect(found).toBeTruthy();
      expect(found!.id).toBe('n-1');
    });

    it('returns null for non-existent notice', async () => {
      const store = createInMemoryStorage();
      expect(await store.notices.findById('nope')).toBeNull();
    });

    it('finds notices by content ID', async () => {
      const store = createInMemoryStorage();
      await store.notices.save(makeNotice({ id: 'n-1', content: { contentId: 'post-42', contentType: 'text' } }));
      await store.notices.save(makeNotice({ id: 'n-2', content: { contentId: 'post-42', contentType: 'text' } }));
      await store.notices.save(makeNotice({ id: 'n-3', content: { contentId: 'post-99', contentType: 'text' } }));

      const results = await store.notices.findByContentId('post-42');
      expect(results).toHaveLength(2);
    });

    it('finds notices by state with pagination', async () => {
      const store = createInMemoryStorage();
      for (let i = 0; i < 5; i++) {
        await store.notices.save(makeNotice({ state: NoticeState.RECEIVED }));
      }
      await store.notices.save(makeNotice({ state: NoticeState.ACKNOWLEDGED }));

      const result = await store.notices.findByState(NoticeState.RECEIVED, { limit: 3 });
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(5);
    });

    it('filters notices with complex query', async () => {
      const store = createInMemoryStorage();
      await store.notices.save(makeNotice({
        id: 'n-trusted',
        source: { type: 'SOURCE_TRUSTED_FLAGGER', reporterId: 'tf1', isTrustedFlagger: true },
        state: NoticeState.ASSESSING,
      }));
      await store.notices.save(makeNotice({ id: 'n-regular', state: NoticeState.ASSESSING }));

      const result = await store.notices.find({ state: NoticeState.ASSESSING, isTrustedFlagger: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('n-trusted');
    });

    it('updates a notice', async () => {
      const store = createInMemoryStorage();
      await store.notices.save(makeNotice({ id: 'n-1', state: NoticeState.RECEIVED }));

      const updated = await store.notices.update('n-1', { state: NoticeState.ACKNOWLEDGED });
      expect(updated.state).toBe(NoticeState.ACKNOWLEDGED);
      expect(updated.id).toBe('n-1');

      const found = await store.notices.findById('n-1');
      expect(found!.state).toBe(NoticeState.ACKNOWLEDGED);
    });

    it('deep-merges nested objects on update (timestamps)', async () => {
      const store = createInMemoryStorage();
      const received = new Date('2025-01-01');
      await store.notices.save(makeNotice({ id: 'n-dm', timestamps: { received } }));

      const acknowledged = new Date('2025-01-02');
      const updated = await store.notices.update('n-dm', {
        state: NoticeState.ACKNOWLEDGED,
        timestamps: { acknowledged } as any,
      });

      // Both timestamps should be present (merged, not replaced)
      expect(updated.timestamps.received).toEqual(received);
      expect(updated.timestamps.acknowledged).toEqual(acknowledged);
    });

    it('throws on updating non-existent notice', async () => {
      const store = createInMemoryStorage();
      await expect(store.notices.update('nope', {})).rejects.toThrow('not found');
    });

    it('deletes a notice', async () => {
      const store = createInMemoryStorage();
      await store.notices.save(makeNotice({ id: 'n-1' }));
      expect(await store.notices.delete('n-1')).toBe(true);
      expect(await store.notices.findById('n-1')).toBeNull();
    });

    it('counts notices with and without filters', async () => {
      const store = createInMemoryStorage();
      await store.notices.save(makeNotice({ state: NoticeState.RECEIVED }));
      await store.notices.save(makeNotice({ state: NoticeState.RECEIVED }));
      await store.notices.save(makeNotice({ state: NoticeState.ACKNOWLEDGED }));

      expect(await store.notices.count()).toBe(3);
      expect(await store.notices.count({ state: NoticeState.RECEIVED })).toBe(2);
    });

    it('returns cloned objects (no mutation leakage)', async () => {
      const store = createInMemoryStorage();
      const original = makeNotice({ id: 'n-1' });
      const saved = await store.notices.save(original);
      saved.state = NoticeState.CLOSED;

      const found = await store.notices.findById('n-1');
      expect(found!.state).toBe(NoticeState.RECEIVED);
    });
  });

  describe('appeals', () => {
    it('saves and retrieves an appeal', async () => {
      const store = createInMemoryStorage();
      await store.appeals.save(makeAppeal({ id: 'a-1' }));
      const found = await store.appeals.findById('a-1');
      expect(found).toBeTruthy();
      expect(found!.appellantId).toBe('user-1');
    });

    it('finds appeals by appellant', async () => {
      const store = createInMemoryStorage();
      await store.appeals.save(makeAppeal({ appellantId: 'user-1' }));
      await store.appeals.save(makeAppeal({ appellantId: 'user-1' }));
      await store.appeals.save(makeAppeal({ appellantId: 'user-2' }));

      const result = await store.appeals.findByAppellant('user-1');
      expect(result.items).toHaveLength(2);
    });

    it('finds appeals by statement reference', async () => {
      const store = createInMemoryStorage();
      await store.appeals.save(makeAppeal({ id: 'a-1', statementReference: 'SOR-2025-001' }));
      await store.appeals.save(makeAppeal({ id: 'a-2', statementReference: 'SOR-2025-001' }));

      const results = await store.appeals.findByStatement('SOR-2025-001');
      expect(results).toHaveLength(2);
    });

    it('filters appeals', async () => {
      const store = createInMemoryStorage();
      await store.appeals.save(makeAppeal({ id: 'a-1', state: AppealState.SUBMITTED }));
      await store.appeals.save(makeAppeal({ id: 'a-2', state: AppealState.RESOLVED }));

      const result = await store.appeals.find({ state: AppealState.SUBMITTED });
      expect(result.items).toHaveLength(1);
    });

    it('deep-merges timestamps on appeal update', async () => {
      const store = createInMemoryStorage();
      const submitted = new Date('2025-03-01');
      const windowExpiresAt = new Date('2025-09-01');
      await store.appeals.save(makeAppeal({ id: 'a-dm', timestamps: { submitted, windowExpiresAt } }));

      const assigned = new Date('2025-03-02');
      const updated = await store.appeals.update('a-dm', {
        state: AppealState.ASSIGNED,
        timestamps: { assigned } as any,
      });

      // All timestamps should be present (merged, not replaced)
      expect(updated.timestamps.submitted).toEqual(submitted);
      expect(updated.timestamps.windowExpiresAt).toEqual(windowExpiresAt);
      expect(updated.timestamps.assigned).toEqual(assigned);
    });

    it('updates and deletes appeals', async () => {
      const store = createInMemoryStorage();
      await store.appeals.save(makeAppeal({ id: 'a-1' }));

      await store.appeals.update('a-1', { state: AppealState.ASSIGNED, assignedReviewer: 'r1' });
      const updated = await store.appeals.findById('a-1');
      expect(updated!.state).toBe(AppealState.ASSIGNED);

      expect(await store.appeals.delete('a-1')).toBe(true);
      expect(await store.appeals.findById('a-1')).toBeNull();
    });

    it('counts appeals', async () => {
      const store = createInMemoryStorage();
      await store.appeals.save(makeAppeal());
      await store.appeals.save(makeAppeal());
      expect(await store.appeals.count()).toBe(2);
    });
  });

  describe('queue', () => {
    function makeQueueItem(): QueuedStatement {
      return {
        id: crypto.randomUUID(),
        submission: {
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
          puid: 'test-puid',
        } as any,
        addedAt: new Date(),
        attempts: 0,
        status: 'pending',
      };
    }

    it('saves and finds pending items', async () => {
      const store = createInMemoryStorage();
      await store.queue.save(makeQueueItem());
      await store.queue.save(makeQueueItem());

      const pending = await store.queue.findPending(10);
      expect(pending).toHaveLength(2);
    });

    it('marks items as completed (deletes them)', async () => {
      const store = createInMemoryStorage();
      const item = makeQueueItem();
      await store.queue.save(item);

      await store.queue.markCompleted(item.id);
      expect(await store.queue.count()).toBe(0);
    });

    it('marks items as failed', async () => {
      const store = createInMemoryStorage();
      const item = makeQueueItem();
      await store.queue.save(item);

      await store.queue.markFailed(item.id, 'API error');
      const pending = await store.queue.findPending(10);
      expect(pending).toHaveLength(1);
      expect(pending[0].attempts).toBe(1);
      expect(pending[0].lastError).toBe('API error');
    });

    it('marks items as permanently failed after max retries', async () => {
      const store = createInMemoryStorage();
      const item = { ...makeQueueItem(), attempts: 4 };
      await store.queue.save(item);

      await store.queue.markFailed(item.id, 'Still failing');
      const pending = await store.queue.findPending(10);
      expect(pending).toHaveLength(0); // status = 'failed', not returned
    });
  });
});
