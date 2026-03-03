/**
 * Offline queue interface and in-memory implementation.
 */

import type { SorSubmission, SorSubmissionResponse } from '../schemas/api-types.js';

export interface QueuedStatement {
  id: string;
  submission: SorSubmission;
  addedAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed';
}

export interface OfflineQueue {
  enqueue(submission: SorSubmission): Promise<QueuedStatement>;
  dequeue(limit: number): Promise<QueuedStatement[]>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  size(): Promise<number>;
  flush(submitter: (submission: SorSubmission) => Promise<SorSubmissionResponse>): Promise<{
    submitted: number;
    failed: number;
  }>;
}

export class InMemoryQueue implements OfflineQueue {
  private items: Map<string, QueuedStatement> = new Map();
  private maxSize: number;
  private maxRetries: number;

  constructor(options?: { maxSize?: number; maxRetries?: number }) {
    this.maxSize = options?.maxSize ?? 10_000;
    this.maxRetries = options?.maxRetries ?? 5;
  }

  async enqueue(submission: SorSubmission): Promise<QueuedStatement> {
    if (this.items.size >= this.maxSize) {
      throw new Error(`Queue is full (max ${this.maxSize} items)`);
    }

    const item: QueuedStatement = {
      id: crypto.randomUUID(),
      submission,
      addedAt: new Date(),
      attempts: 0,
      status: 'pending',
    };

    this.items.set(item.id, item);
    return { ...item };
  }

  async dequeue(limit: number): Promise<QueuedStatement[]> {
    const pending: QueuedStatement[] = [];
    for (const item of this.items.values()) {
      if (item.status === 'pending' && item.attempts < this.maxRetries) {
        pending.push({ ...item });
        if (pending.length >= limit) break;
      }
    }
    return pending;
  }

  async markCompleted(id: string): Promise<void> {
    this.items.delete(id);
  }

  async markFailed(id: string, error: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.attempts += 1;
      item.lastAttemptAt = new Date();
      item.lastError = error;
      item.status = item.attempts >= this.maxRetries ? 'failed' : 'pending';
    }
  }

  async size(): Promise<number> {
    return this.items.size;
  }

  async flush(submitter: (submission: SorSubmission) => Promise<SorSubmissionResponse>): Promise<{
    submitted: number;
    failed: number;
  }> {
    let submitted = 0;
    let failed = 0;

    const pending = await this.dequeue(this.items.size);
    for (const item of pending) {
      try {
        await submitter(item.submission);
        await this.markCompleted(item.id);
        submitted++;
      } catch (error) {
        await this.markFailed(item.id, error instanceof Error ? error.message : String(error));
        failed++;
      }
    }

    return { submitted, failed };
  }
}
