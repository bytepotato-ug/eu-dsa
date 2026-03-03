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
export declare class InMemoryQueue implements OfflineQueue {
    private items;
    private maxSize;
    private maxRetries;
    constructor(options?: {
        maxSize?: number;
        maxRetries?: number;
    });
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
//# sourceMappingURL=queue.d.ts.map