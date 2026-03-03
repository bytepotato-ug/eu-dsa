// Schemas & Types
export * from './schemas/index.js';

// API Client
export { TransparencyDatabaseClient, type TransparencyDatabaseClientConfig } from './api/client.js';
export {
  DsaToolkitError,
  DsaValidationError,
  DsaNetworkError,
  DsaApiError,
  DsaAuthError,
  DsaPuidConflictError,
  DsaRateLimitError,
  DsaBatchError,
} from './api/errors.js';
export type { RequestInterceptor, ResponseInterceptor, RequestContext, ResponseContext } from './api/interceptors.js';
export type { RetryConfig } from './api/retry.js';
export { InMemoryQueue, type OfflineQueue, type QueuedStatement } from './api/queue.js';

// SoR Builder
export { SoRBuilder } from './sor/builder.js';
export { deterministicPuid, randomPuid, hashedPuid, timestampPuid, isValidPuid } from './sor/puid.js';
export {
  pseudonymizeUserId,
  pseudonymizeText,
  stripIpAddresses,
  stripEmails,
  stripMentions,
  sanitizeForSubmission,
  type PseudonymizationConfig,
} from './sor/pseudonymize.js';
export { createPlatformMapper, type PlatformMappingConfig, type CategoryMapping } from './sor/mapper.js';

// Events
export { createDsaEventEmitter, type DsaEventEmitter, type DsaEventHandler } from './events/emitter.js';
export type { DsaEventMap, DsaEventName } from './events/types.js';

// Notice-and-Action Engine
export { NoticeState } from './notice/types.js';
export type { Notice, NoticeSource, NoticeClassification, NoticeDecision, ContentSnapshot, StateTransition, NoticeCreateParams } from './notice/types.js';
export { NoticeStateMachine, createNotice, type NoticeStateMachineConfig } from './notice/state-machine.js';
export { calculateDeadline, getNoticeDeadlines, getDeadlineAlerts, type Deadline, type DeadlineType, type DeadlineConfig } from './notice/deadlines.js';
export { calculatePriority, evaluateFlaggerStatus, applyCommunityBonus, type TrustedFlaggerConfig, type FlaggerStats, type FlaggerEvaluation } from './notice/trusted-flagger.js';

// Appeals / Complaint Handler
export { AppealState, AppealOutcomeResult } from './appeals/types.js';
export type { Appeal, AppealCreateParams, AppealOutcome, AppealStats } from './appeals/types.js';
export { isAppealWindowOpen, getAppealWindowStatus, calculateAppealWindowEnd, type AppealWindowConfig, type AppealWindowStatus } from './appeals/window.js';
export { AppealWorkflow, type AppealWorkflowConfig } from './appeals/workflow.js';

// Storage
export type { StorageAdapter, ListOptions, PaginatedResult, NoticeFilters, AppealFilters } from './storage/adapter.js';
export { createInMemoryStorage } from './storage/memory.js';

// Transparency Reports
export { DsaTier } from './reports/types.js';
export type { ReportingPeriod, TransparencyReport, ReportIdentification, TransparencyDataProvider } from './reports/index.js';
export { TransparencyReportGenerator, createReportGenerator, type ReportGeneratorConfig } from './reports/generator.js';
export { toCSV, toJSON, toMarkdown, type CSVParts } from './reports/formatters.js';
