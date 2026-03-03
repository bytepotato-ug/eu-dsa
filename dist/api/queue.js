/**
 * Offline queue interface and in-memory implementation.
 */
import { randomUUID } from 'node:crypto';
export class InMemoryQueue {
    items = new Map();
    maxSize;
    maxRetries;
    constructor(options) {
        this.maxSize = options?.maxSize ?? 10_000;
        this.maxRetries = options?.maxRetries ?? 5;
    }
    async enqueue(submission) {
        if (this.items.size >= this.maxSize) {
            throw new Error(`Queue is full (max ${this.maxSize} items)`);
        }
        const item = {
            id: randomUUID(),
            submission,
            addedAt: new Date(),
            attempts: 0,
            status: 'pending',
        };
        this.items.set(item.id, item);
        return { ...item };
    }
    async dequeue(limit) {
        const pending = [];
        for (const item of this.items.values()) {
            if (item.status === 'pending' && item.attempts < this.maxRetries) {
                pending.push({ ...item });
                if (pending.length >= limit)
                    break;
            }
        }
        return pending;
    }
    async markCompleted(id) {
        this.items.delete(id);
    }
    async markFailed(id, error) {
        const item = this.items.get(id);
        if (item) {
            item.attempts += 1;
            item.lastAttemptAt = new Date();
            item.lastError = error;
            item.status = item.attempts >= this.maxRetries ? 'failed' : 'pending';
        }
    }
    async size() {
        return this.items.size;
    }
    async flush(submitter) {
        let submitted = 0;
        let failed = 0;
        const pending = await this.dequeue(this.items.size);
        for (const item of pending) {
            try {
                await submitter(item.submission);
                await this.markCompleted(item.id);
                submitted++;
            }
            catch (error) {
                await this.markFailed(item.id, error instanceof Error ? error.message : String(error));
                failed++;
            }
        }
        return { submitted, failed };
    }
}
//# sourceMappingURL=queue.js.map