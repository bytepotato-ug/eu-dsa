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
