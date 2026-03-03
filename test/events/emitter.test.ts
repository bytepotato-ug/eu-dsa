import { describe, it, expect, vi } from 'vitest';
import { createDsaEventEmitter } from '../../src/events/emitter.js';

describe('DsaEventEmitter', () => {
  it('emits and receives typed events', () => {
    const emitter = createDsaEventEmitter();
    const handler = vi.fn();

    emitter.on('sor.submitted', handler);
    emitter.emit('sor.submitted', {
      submission: {} as any,
      response: { uuid: 'abc', id: 1 } as any,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].response.uuid).toBe('abc');
  });

  it('supports multiple handlers on same event', () => {
    const emitter = createDsaEventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on('api.error', h1);
    emitter.on('api.error', h2);
    emitter.emit('api.error', { error: new Error('fail'), endpoint: '/test' });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('once handler fires only once', () => {
    const emitter = createDsaEventEmitter();
    const handler = vi.fn();

    emitter.once('notice.received', handler);
    emitter.emit('notice.received', { noticeId: 'n1', category: 'spam' });
    emitter.emit('notice.received', { noticeId: 'n2', category: 'hate' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].noticeId).toBe('n1');
  });

  it('off removes a handler', () => {
    const emitter = createDsaEventEmitter();
    const handler = vi.fn();

    emitter.on('appeal.submitted', handler);
    emitter.off('appeal.submitted', handler);
    emitter.emit('appeal.submitted', { appealId: 'a1', appellantId: 'u1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears all handlers for an event', () => {
    const emitter = createDsaEventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on('api.rate_limited', h1);
    emitter.on('api.rate_limited', h2);
    emitter.removeAllListeners('api.rate_limited');
    emitter.emit('api.rate_limited', { retryAfterMs: 5000 });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('removeAllListeners with no arg clears everything', () => {
    const emitter = createDsaEventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on('sor.validated', h1);
    emitter.on('notice.decided', h2);
    emitter.removeAllListeners();
    emitter.emit('sor.validated', { submission: {} as any });
    emitter.emit('notice.decided', { noticeId: 'n1', decision: 'removed' });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('listenerCount returns correct count', () => {
    const emitter = createDsaEventEmitter();
    expect(emitter.listenerCount('sor.submitted')).toBe(0);

    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('sor.submitted', h1);
    emitter.on('sor.submitted', h2);
    expect(emitter.listenerCount('sor.submitted')).toBe(2);

    emitter.off('sor.submitted', h1);
    expect(emitter.listenerCount('sor.submitted')).toBe(1);
  });

  it('handles all event types without error', () => {
    const emitter = createDsaEventEmitter();
    const handler = vi.fn();

    // Just verify we can emit every event type without type errors or runtime crashes
    emitter.on('sor.validated', handler);
    emitter.on('sor.submission_failed', handler);
    emitter.on('sor.batch_submitted', handler);
    emitter.on('sor.queued', handler);
    emitter.on('sor.queue_flushed', handler);
    emitter.on('notice.acknowledged', handler);
    emitter.on('notice.state_changed', handler);
    emitter.on('notice.deadline_warning', handler);
    emitter.on('notice.deadline_expired', handler);
    emitter.on('appeal.assigned', handler);
    emitter.on('appeal.resolved', handler);
    emitter.on('appeal.window_expiring', handler);
    emitter.on('report.generated', handler);
    emitter.on('report.exported', handler);
    emitter.on('storage.error', handler);

    emitter.emit('sor.batch_submitted', { count: 10, succeeded: 9, failed: 1 });
    emitter.emit('notice.deadline_warning', { noticeId: 'n1', deadlineType: 'NETZDG_24H', remainingMs: 3600000 });
    emitter.emit('appeal.window_expiring', { statementReference: 'SOR-001', expiresAt: new Date() });
    emitter.emit('report.generated', { period: { year: 2025 }, tier: 'PLATFORM' });
    emitter.emit('storage.error', { error: new Error('disk full'), operation: 'save' });

    expect(handler).toHaveBeenCalledTimes(5);
  });
});
