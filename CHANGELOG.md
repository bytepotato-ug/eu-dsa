# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-03

### Added
- ESLint configuration with `@typescript-eslint/recommended`
- Lint step in CI/CD pipeline (ci.yml and release.yml)
- Test coverage for retry-after header parsing (HTTP-date, invalid, past date)
- Test coverage for rate limit header parsing (valid, NaN, missing reset)
- Test coverage for Markdown qualitative sections (outOfCourtSettlements, other)
- Test coverage for interceptor chain ordering and error propagation
- Complete documentation: API reference, architecture guide, examples, error handling (`docs/`)
- This changelog

### Changed
- Version bump to 1.0.0 — stable public API

## [0.5.0] - 2026-03-03

### Added
- Transparency report generator (`TransparencyReportGenerator`, `createReportGenerator`)
- `TransparencyDataProvider` interface for platform data integration
- `DsaTier` enum: `INTERMEDIARY`, `PLATFORM`, `VLOP`
- Tier-aware report generation (only includes parts applicable to platform tier)
- Report formatters: `toCSV()` (11 parts per EU template), `toJSON()`, `toMarkdown()`
- Report types: `ReportingPeriod`, `TransparencyReport`, `ReportIdentification`
- Data types for all 10 quantitative parts + qualitative section
- Subpath export `eu-dsa/reports`

## [0.2.0] - 2026-03-03

### Added
- Notice-and-action engine per DSA Art. 16
  - `NoticeStateMachine` with 9 states and configurable transitions
  - `createNotice()` factory function
  - Deadline calculator (`calculateDeadline`, `getNoticeDeadlines`, `getDeadlineAlerts`)
  - NetzDG 24h/7d and DSA acknowledgment deadline support
- Trusted flagger integration per DSA Art. 22
  - `calculatePriority()` with configurable multiplier
  - `evaluateFlaggerStatus()` with accuracy threshold
  - `applyCommunityBonus()` for multiple-reporter risk scoring
- Appeal/complaint handler per DSA Art. 20
  - `AppealWorkflow` state machine (5 states)
  - 6-month filing window enforcement
  - Different-reviewer rule (Art. 20(4))
  - `isAppealWindowOpen()`, `getAppealWindowStatus()`, `calculateAppealWindowEnd()`
- Typed event emitter (`createDsaEventEmitter`) with 21 lifecycle events
- Storage adapter interface (`StorageAdapter`) with 3 sub-interfaces
  - `notices` (8 methods), `appeals` (8 methods), `queue` (5 methods)
  - `createInMemoryStorage()` implementation for testing
- Offline queue (`InMemoryQueue`) with `submitOrQueue()` and `flushQueue()`
- Subpath exports: `eu-dsa/notice`, `eu-dsa/appeals`, `eu-dsa/events`, `eu-dsa/storage`

## [0.1.0] - 2026-03-03

### Added
- Initial release
- Core Zod schemas for EU Transparency Database API
  - `sorSubmissionSchema` with 5 conditional validation rules
  - 160+ EU-standard enum values across 12 enum types
  - `SorSubmission`, `SorSubmissionResponse`, `SorBatchResponse` types
- `TransparencyDatabaseClient` — typed HTTP client
  - `submitStatement()`, `submitStatements()` (auto-chunks >100)
  - `checkPuid()`, `getStatement()`, `ping()`
  - Rate limit tracking with `getRateLimitInfo()`
- Request/response interceptors for audit logging
- Retry with exponential backoff and jitter (`withRetry`, `RetryConfig`)
- `SoRBuilder` — fluent builder with 30+ chainable methods
- PUID generation: `deterministicPuid`, `randomPuid`, `hashedPuid`, `timestampPuid`
- PUID validation: `isValidPuid`
- GDPR pseudonymization: `pseudonymizeUserId`, `pseudonymizeText`, `stripIpAddresses`, `stripEmails`, `stripMentions`, `sanitizeForSubmission`
- `createPlatformMapper` for bridging platform categories to EU taxonomy
- Error class hierarchy: `DsaToolkitError`, `DsaValidationError`, `DsaNetworkError`, `DsaApiError`, `DsaAuthError`, `DsaPuidConflictError`, `DsaRateLimitError`, `DsaBatchError`
- Subpath exports: `eu-dsa/schemas`, `eu-dsa/api`, `eu-dsa/sor`
