/**
 * Abstract StorageAdapter interface.
 *
 * Provides a database-agnostic abstraction for persisting notices,
 * appeals, and queued statements. Platforms implement this for their
 * specific database (PostgreSQL, SQLite, etc.).
 *
 * An InMemoryStorage ships with core for testing.
 */

import type { Notice, NoticeState } from '../notice/types.js';
import type { Appeal, AppealState } from '../appeals/types.js';
import type { QueuedStatement } from '../api/queue.js';

export interface ListOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface NoticeFilters {
  state?: NoticeState | NoticeState[];
  sourceType?: string;
  isTrustedFlagger?: boolean;
  contentId?: string;
  assignedTo?: string;
  receivedAfter?: Date;
  receivedBefore?: Date;
}

export interface AppealFilters {
  state?: AppealState | AppealState[];
  appellantId?: string;
  assignedReviewer?: string;
  submittedAfter?: Date;
  submittedBefore?: Date;
}

export interface StorageAdapter {
  notices: {
    save(notice: Notice): Promise<Notice>;
    findById(id: string): Promise<Notice | null>;
    findByContentId(contentId: string): Promise<Notice[]>;
    findByState(state: NoticeState, options?: ListOptions): Promise<PaginatedResult<Notice>>;
    find(filters: NoticeFilters, options?: ListOptions): Promise<PaginatedResult<Notice>>;
    update(id: string, data: Partial<Notice>): Promise<Notice>;
    delete(id: string): Promise<boolean>;
    count(filters?: NoticeFilters): Promise<number>;
  };
  appeals: {
    save(appeal: Appeal): Promise<Appeal>;
    findById(id: string): Promise<Appeal | null>;
    findByAppellant(appellantId: string, options?: ListOptions): Promise<PaginatedResult<Appeal>>;
    findByStatement(ref: string): Promise<Appeal[]>;
    find(filters: AppealFilters, options?: ListOptions): Promise<PaginatedResult<Appeal>>;
    update(id: string, data: Partial<Appeal>): Promise<Appeal>;
    delete(id: string): Promise<boolean>;
    count(filters?: AppealFilters): Promise<number>;
  };
  queue: {
    save(item: QueuedStatement): Promise<QueuedStatement>;
    findPending(limit: number): Promise<QueuedStatement[]>;
    markCompleted(id: string): Promise<void>;
    markFailed(id: string, error: string): Promise<void>;
    count(): Promise<number>;
  };
}
