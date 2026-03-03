/**
 * Typed event definitions for DSA toolkit lifecycle events.
 */

import type { SorSubmission, SorSubmissionResponse } from '../schemas/api-types.js';
import type { QueuedStatement } from '../api/queue.js';

export interface DsaEventMap {
  'sor.validated': { submission: SorSubmission };
  'sor.submitted': { submission: SorSubmission; response: SorSubmissionResponse };
  'sor.submission_failed': { submission: SorSubmission; error: Error };
  'sor.batch_submitted': { count: number; succeeded: number; failed: number };
  'sor.queued': { statement: QueuedStatement };
  'sor.queue_flushed': { submitted: number; failed: number };
  'notice.received': { noticeId: string; category: string };
  'notice.acknowledged': { noticeId: string };
  'notice.state_changed': { noticeId: string; from: string; to: string; actorId: string };
  'notice.decided': { noticeId: string; decision: string };
  'notice.deadline_warning': { noticeId: string; deadlineType: string; remainingMs: number };
  'notice.deadline_expired': { noticeId: string; deadlineType: string };
  'appeal.submitted': { appealId: string; appellantId: string };
  'appeal.assigned': { appealId: string; reviewerId: string };
  'appeal.resolved': { appealId: string; outcome: string };
  'appeal.window_expiring': { statementReference: string; expiresAt: Date };
  'report.generated': { period: { year: number }; tier: string };
  'report.exported': { format: 'CSV' | 'XLSX' | 'JSON' | 'MARKDOWN' };
  'api.rate_limited': { retryAfterMs: number };
  'api.error': { error: Error; endpoint: string };
  'storage.error': { error: Error; operation: string };
}

export type DsaEventName = keyof DsaEventMap;
