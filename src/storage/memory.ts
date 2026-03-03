/**
 * In-memory StorageAdapter implementation for testing.
 */

import type { Notice, NoticeState } from '../notice/types.js';
import type { Appeal } from '../appeals/types.js';
import type { QueuedStatement } from '../api/queue.js';
import type {
  StorageAdapter,
  ListOptions,
  PaginatedResult,
  NoticeFilters,
  AppealFilters,
} from './adapter.js';

function paginate<T>(items: T[], options?: ListOptions): PaginatedResult<T> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const page = items.slice(offset, offset + limit);
  return { items: page, total: items.length, limit, offset };
}

function matchesNoticeFilters(notice: Notice, filters: NoticeFilters): boolean {
  if (filters.state) {
    const states = Array.isArray(filters.state) ? filters.state : [filters.state];
    if (!states.includes(notice.state)) return false;
  }
  if (filters.sourceType && notice.source.type !== filters.sourceType) return false;
  if (filters.isTrustedFlagger !== undefined && notice.source.isTrustedFlagger !== filters.isTrustedFlagger) return false;
  if (filters.contentId && notice.content.contentId !== filters.contentId) return false;
  if (filters.assignedTo && notice.assignedTo !== filters.assignedTo) return false;
  if (filters.receivedAfter && notice.timestamps.received < filters.receivedAfter) return false;
  if (filters.receivedBefore && notice.timestamps.received > filters.receivedBefore) return false;
  return true;
}

function matchesAppealFilters(appeal: Appeal, filters: AppealFilters): boolean {
  if (filters.state) {
    const states = Array.isArray(filters.state) ? filters.state : [filters.state];
    if (!states.includes(appeal.state)) return false;
  }
  if (filters.appellantId && appeal.appellantId !== filters.appellantId) return false;
  if (filters.assignedReviewer && appeal.assignedReviewer !== filters.assignedReviewer) return false;
  if (filters.submittedAfter && appeal.timestamps.submitted < filters.submittedAfter) return false;
  if (filters.submittedBefore && appeal.timestamps.submitted > filters.submittedBefore) return false;
  return true;
}

export function createInMemoryStorage(): StorageAdapter {
  const notices = new Map<string, Notice>();
  const appeals = new Map<string, Appeal>();
  const queue = new Map<string, QueuedStatement>();

  return {
    notices: {
      async save(notice: Notice): Promise<Notice> {
        const stored = structuredClone(notice);
        notices.set(stored.id, stored);
        return structuredClone(stored);
      },

      async findById(id: string): Promise<Notice | null> {
        const notice = notices.get(id);
        return notice ? structuredClone(notice) : null;
      },

      async findByContentId(contentId: string): Promise<Notice[]> {
        return [...notices.values()]
          .filter(n => n.content.contentId === contentId)
          .map(n => structuredClone(n));
      },

      async findByState(state: NoticeState, options?: ListOptions): Promise<PaginatedResult<Notice>> {
        const filtered = [...notices.values()].filter(n => n.state === state);
        return paginate(filtered.map(n => structuredClone(n)), options);
      },

      async find(filters: NoticeFilters, options?: ListOptions): Promise<PaginatedResult<Notice>> {
        const filtered = [...notices.values()].filter(n => matchesNoticeFilters(n, filters));
        return paginate(filtered.map(n => structuredClone(n)), options);
      },

      async update(id: string, data: Partial<Notice>): Promise<Notice> {
        const existing = notices.get(id);
        if (!existing) throw new Error(`Notice ${id} not found`);
        const updated = { ...structuredClone(existing), ...data, id };
        notices.set(id, updated);
        return structuredClone(updated);
      },

      async delete(id: string): Promise<boolean> {
        return notices.delete(id);
      },

      async count(filters?: NoticeFilters): Promise<number> {
        if (!filters) return notices.size;
        return [...notices.values()].filter(n => matchesNoticeFilters(n, filters)).length;
      },
    },

    appeals: {
      async save(appeal: Appeal): Promise<Appeal> {
        const stored = structuredClone(appeal);
        appeals.set(stored.id, stored);
        return structuredClone(stored);
      },

      async findById(id: string): Promise<Appeal | null> {
        const appeal = appeals.get(id);
        return appeal ? structuredClone(appeal) : null;
      },

      async findByAppellant(appellantId: string, options?: ListOptions): Promise<PaginatedResult<Appeal>> {
        const filtered = [...appeals.values()].filter(a => a.appellantId === appellantId);
        return paginate(filtered.map(a => structuredClone(a)), options);
      },

      async findByStatement(ref: string): Promise<Appeal[]> {
        return [...appeals.values()]
          .filter(a => a.statementReference === ref)
          .map(a => structuredClone(a));
      },

      async find(filters: AppealFilters, options?: ListOptions): Promise<PaginatedResult<Appeal>> {
        const filtered = [...appeals.values()].filter(a => matchesAppealFilters(a, filters));
        return paginate(filtered.map(a => structuredClone(a)), options);
      },

      async update(id: string, data: Partial<Appeal>): Promise<Appeal> {
        const existing = appeals.get(id);
        if (!existing) throw new Error(`Appeal ${id} not found`);
        const updated = { ...structuredClone(existing), ...data, id };
        appeals.set(id, updated);
        return structuredClone(updated);
      },

      async delete(id: string): Promise<boolean> {
        return appeals.delete(id);
      },

      async count(filters?: AppealFilters): Promise<number> {
        if (!filters) return appeals.size;
        return [...appeals.values()].filter(a => matchesAppealFilters(a, filters)).length;
      },
    },

    queue: {
      async save(item: QueuedStatement): Promise<QueuedStatement> {
        const stored = structuredClone(item);
        queue.set(stored.id, stored);
        return structuredClone(stored);
      },

      async findPending(limit: number): Promise<QueuedStatement[]> {
        return [...queue.values()]
          .filter(i => i.status === 'pending')
          .slice(0, limit)
          .map(i => structuredClone(i));
      },

      async markCompleted(id: string): Promise<void> {
        queue.delete(id);
      },

      async markFailed(id: string, error: string): Promise<void> {
        const item = queue.get(id);
        if (item) {
          item.attempts += 1;
          item.lastAttemptAt = new Date();
          item.lastError = error;
          item.status = item.attempts >= 5 ? 'failed' : 'pending';
        }
      },

      async count(): Promise<number> {
        return queue.size;
      },
    },
  };
}
