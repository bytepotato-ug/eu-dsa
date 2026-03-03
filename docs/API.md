# API Reference

Complete reference for all exported functions, classes, and types.

**Import patterns:**
```ts
// Everything from the main entry
import { SoRBuilder, TransparencyDatabaseClient, ... } from 'eu-dsa';

// Module-specific imports (tree-shakeable)
import { SoRBuilder } from 'eu-dsa/sor';
import { TransparencyDatabaseClient } from 'eu-dsa/api';
```

---

## Table of Contents

- [Schemas Module](#schemas-module)
- [API Client Module](#api-client-module)
- [SoR Builder Module](#sor-builder-module)
- [Notice Engine Module](#notice-engine-module)
- [Appeals Module](#appeals-module)
- [Events Module](#events-module)
- [Reports Module](#reports-module)
- [Storage Module](#storage-module)

---

## Schemas Module

`import { ... } from 'eu-dsa/schemas'`

### Enums

All enums use `as const` objects with matching type aliases.

| Enum | Values | Description |
|------|--------|-------------|
| `DecisionVisibility` | `CONTENT_REMOVED`, `CONTENT_DISABLED`, `CONTENT_DEMOTED`, `CONTENT_AGE_RESTRICTED`, `CONTENT_INTERACTION_RESTRICTED`, `CONTENT_LABELLED`, `OTHER` | Visibility restriction types |
| `DecisionMonetary` | `MONETARY_SUSPENSION`, `MONETARY_TERMINATION`, `MONETARY_OTHER` | Monetary payment restrictions |
| `DecisionProvision` | `PROVISION_PARTIAL_SUSPENSION`, `PROVISION_TOTAL_SUSPENSION`, `PROVISION_PARTIAL_TERMINATION`, `PROVISION_TOTAL_TERMINATION` | Service provision restrictions |
| `DecisionAccount` | `SUSPENDED`, `TERMINATED` | Account-level actions |
| `AccountType` | `BUSINESS`, `PRIVATE` | Account classification |
| `DecisionGround` | `ILLEGAL_CONTENT`, `INCOMPATIBLE_CONTENT` | Legal basis for decisions |
| `Category` | 30+ values | Content categories (e.g., `ILLEGAL_OR_HARMFUL_SPEECH`, `PORNOGRAPHY_OR_SEXUALIZED_CONTENT`) |
| `CategorySpecification` | 60+ values | Granular sub-categories |
| `ContentType` | `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `MIXED`, `OTHER` | Content format |
| `SourceType` | `ARTICLE_16`, `TRUSTED_FLAGGER`, `OWN_INITIATIVE`, `ORDER` | How the content was flagged |
| `AutomatedDecision` | `NOT_AUTOMATED`, `PARTIALLY_AUTOMATED`, `FULLY_AUTOMATED` | Automation level |
| `TerritorialScopeCode` | EU member state ISO codes | 27 EU member states + EEA |

### Zod Schema

#### `sorSubmissionSchema`

Validates `SorSubmission` objects with 5 conditional rules:
- `illegal_content_legal_ground` required when `decision_ground` is `ILLEGAL_CONTENT`
- `incompatible_content_ground` required when `decision_ground` is `INCOMPATIBLE_CONTENT`
- `decision_visibility_other` required when visibility includes `OTHER`
- `decision_monetary_other` required when monetary is `MONETARY_OTHER`
- At least one decision type required (visibility, monetary, provision, or account)

### Types

```ts
interface SorSubmission {
  puid: string;
  decision_visibility?: string[];
  decision_visibility_other?: string;
  decision_monetary?: string;
  decision_monetary_other?: string;
  decision_provision?: string;
  decision_account?: string;
  account_type?: string;
  decision_ground: string;
  decision_facts: string;
  illegal_content_legal_ground?: string;
  illegal_content_explanation?: string;
  incompatible_content_ground?: string;
  incompatible_content_explanation?: string;
  incompatible_content_illegal?: string;
  decision_ground_reference_url?: string;
  content_type: string[];
  content_type_other?: string;
  category: string;
  category_addition?: string[];
  category_specification?: string[];
  category_specification_other?: string;
  content_date: string;
  application_date: string;
  end_date_visibility_restriction?: string;
  end_date_monetary_restriction?: string;
  end_date_service_restriction?: string;
  end_date_account_restriction?: string;
  source_type: string;
  source_identity?: string;
  automated_detection: string;
  automated_decision: string;
  territorial_scope: string[];
  content_language?: string;
  content_id?: Record<string, string>;
}

interface SorSubmissionResponse extends SorSubmission {
  id: number;
  uuid: string;
  created_at: string;
  platform_name: string;
  permalink: string;
  self: string;
}

interface SorBatchResponse {
  statements: SorSubmissionResponse[];
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}
```

---

## API Client Module

`import { ... } from 'eu-dsa/api'`

### TransparencyDatabaseClient

HTTP client for the EU Transparency Database API.

#### Constructor

```ts
new TransparencyDatabaseClient(config: TransparencyDatabaseClientConfig)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `token` | `string` | *required* | EU API bearer token |
| `baseUrl` | `string` | Production URL | API base URL |
| `sandbox` | `boolean` | `false` | Use sandbox mode |
| `timeoutMs` | `number` | `30000` | Request timeout in ms |
| `retry` | `Partial<RetryConfig>` | See RetryConfig | Retry configuration |
| `interceptors` | `{ request?, response? }` | `[]` | Request/response interceptors |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |
| `userAgent` | `string` | `eu-dsa/{version}` | User-Agent header |

#### Methods

##### `submitStatement(submission: SorSubmission): Promise<SorSubmissionResponse>`
Submit a single Statement of Reasons. Validates with Zod before sending.
- Throws: `DsaValidationError`, `DsaAuthError`, `DsaRateLimitError`, `DsaApiError`, `DsaNetworkError`

##### `submitStatements(submissions: SorSubmission[]): Promise<SorBatchResponse>`
Submit a batch. Auto-chunks into 100-item batches per EU API limit.
- Throws: Same as `submitStatement`

##### `checkPuid(puid: string): Promise<{ exists: boolean; puid: string }>`
Check if a PUID already exists (GET, returns 302 if found, 404 if not).

##### `getStatement(id: number | string): Promise<SorSubmissionResponse>`
Retrieve a previously submitted Statement of Reasons by ID.

##### `ping(): Promise<{ ok: boolean; latencyMs: number }>`
Test API connection. Never throws — returns `{ ok: false }` on failure.

##### `getRateLimitInfo(): RateLimitInfo | null`
Get rate limit info from the last response.

##### `setQueue(queue: OfflineQueue): void`
Attach an offline queue for automatic fallback.

##### `submitOrQueue(submission: SorSubmission): Promise<SorSubmissionResponse | QueuedStatement>`
Submit with automatic queueing on retryable/network errors.

##### `flushQueue(): Promise<{ submitted: number; failed: number }>`
Process all queued submissions.

### RetryConfig

```ts
interface RetryConfig {
  maxAttempts: number;        // default: 3
  baseDelayMs: number;        // default: 1000
  maxDelayMs: number;         // default: 30000
  retryableStatuses: number[]; // default: [408, 429, 500, 502, 503, 504]
  retryNetworkErrors?: boolean; // default: true
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}
```

### Interceptors

```ts
type RequestInterceptor = (context: RequestContext) => RequestContext | Promise<RequestContext>;
type ResponseInterceptor = (context: ResponseContext) => void | Promise<void>;

interface RequestContext {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: Date;
  requestId: string;
}

interface ResponseContext {
  request: RequestContext;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  timestamp: Date;
}
```

### OfflineQueue / InMemoryQueue

```ts
interface OfflineQueue {
  enqueue(submission: SorSubmission): Promise<QueuedStatement>;
  dequeue(limit: number): Promise<QueuedStatement[]>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  size(): Promise<number>;
  flush(submitter: (sub: SorSubmission) => Promise<SorSubmissionResponse>): Promise<{ submitted: number; failed: number }>;
}

// In-memory implementation
new InMemoryQueue(options?: { maxSize?: number; maxRetries?: number })
```

### Error Classes

See [ERROR-HANDLING.md](./ERROR-HANDLING.md) for detailed error handling patterns.

---

## SoR Builder Module

`import { ... } from 'eu-dsa/sor'`

### SoRBuilder

Fluent builder for constructing EU-compliant Statements of Reasons.

```ts
const sor = new SoRBuilder()
  .contentRemoved()
  .illegalContent('§130 StGB', 'Incitement to hatred')
  .contentType('TEXT')
  .category('ILLEGAL_OR_HARMFUL_SPEECH')
  .dates({ content: '2024-06-15', application: '2024-06-16' })
  .facts('Content contained hate speech.')
  .source('ARTICLE_16')
  .automatedDetection(false)
  .automatedDecision('NOT_AUTOMATED')
  .puid('my-platform-puid-123')
  .territorialScope(['DE'])
  .build();
```

#### Visibility Methods
| Method | Description |
|--------|-------------|
| `visibility(...actions)` | Add visibility restrictions |
| `visibilityOther(description)` | Description for "other" visibility type |
| `contentRemoved()` | Shorthand for CONTENT_REMOVED |
| `contentDisabled()` | Shorthand for CONTENT_DISABLED |
| `contentDemoted()` | Shorthand for CONTENT_DEMOTED |
| `contentAgeRestricted()` | Shorthand for CONTENT_AGE_RESTRICTED |
| `contentInteractionRestricted()` | Shorthand for CONTENT_INTERACTION_RESTRICTED |
| `contentLabelled()` | Shorthand for CONTENT_LABELLED |

#### Other Decision Methods
| Method | Description |
|--------|-------------|
| `monetary(action)` | Set monetary restriction |
| `monetaryOther(description)` | Description for "other" monetary type |
| `provision(action)` | Set provision restriction |
| `account(action)` | Set account action |
| `accountSuspended()` | Shorthand for SUSPENDED |
| `accountTerminated()` | Shorthand for TERMINATED |
| `accountType(type)` | Set account type (BUSINESS/PRIVATE) |

#### Ground Methods
| Method | Description |
|--------|-------------|
| `illegalContent(legalGround, explanation)` | Set illegal content ground |
| `incompatibleContent(ground, explanation, alsoIllegal?)` | Set TOS incompatibility ground |
| `groundReferenceUrl(url)` | Reference URL for the legal ground |

#### Content & Classification
| Method | Description |
|--------|-------------|
| `contentType(...types)` | Set content types |
| `contentTypeOther(description)` | Description for "other" content type |
| `category(cat)` | Set primary category |
| `categoryAddition(...cats)` | Add additional categories |
| `categorySpecification(...specs)` | Add category specifications |
| `categorySpecificationOther(description)` | Description for "other" specification |

#### Dates, Facts & Source
| Method | Description |
|--------|-------------|
| `dates({ content, application })` | Set content and application dates |
| `endDates({ visibility?, monetary?, service?, account? })` | Set restriction end dates |
| `facts(description)` | Set decision facts |
| `source(type, identity?)` | Set source type and optional identity |

#### Automation, ID & Scope
| Method | Description |
|--------|-------------|
| `automatedDetection(used)` | Whether automated detection was used |
| `automatedDecision(level)` | Automation level of the decision |
| `puid(puid)` | Set Platform Unique Identifier |
| `territorialScope(countries)` | Set territorial scope |
| `contentLanguage(lang)` | Set content language |
| `contentId(ean13)` | Set EAN-13 content identifier |

#### Build & Utility
| Method | Returns | Description |
|--------|---------|-------------|
| `build()` | `ValidatedSorSubmission` | Validate and return submission (throws `DsaValidationError`) |
| `validate()` | `{ valid, errors? }` | Non-throwing validation check |
| `toJSON()` | `Partial<SorSubmission>` | Get current data as plain object |
| `reset()` | `this` | Clear all data |

### PUID Generation

```ts
deterministicPuid(ctx: { platform: string; actionType: string; referenceId: string }): string
randomPuid(platform?: string): string
hashedPuid(platform: string, ...components: string[]): string
timestampPuid(platform: string, date?: Date): string
isValidPuid(puid: string): boolean
```

### Pseudonymization

```ts
pseudonymizeUserId(userId: string, config: PseudonymizationConfig): string
pseudonymizeText(text: string, replacements: Map<string, string>): string
stripIpAddresses(text: string): string
stripEmails(text: string): string
stripMentions(text: string): string
stripUserUrls(text: string, patterns?: RegExp[]): string
sanitizeForSubmission(text: string, options?: {
  replacements?: Map<string, string>;
  stripIps?: boolean;          // default: true
  stripEmailAddresses?: boolean; // default: true
  stripUserMentions?: boolean;  // default: false
  urlPatterns?: RegExp[];
}): string
```

### Platform Mapper

```ts
createPlatformMapper<TCategory extends string>(
  config: PlatformMappingConfig<TCategory>
): (builder: SoRBuilder, category: TCategory) => SoRBuilder

interface PlatformMappingConfig<TCategory extends string> {
  platformName: string;
  categories: Record<TCategory, CategoryMapping>;
  defaultContentTypes?: ContentType[];
  defaultTerritorialScope?: TerritorialScopeCode[];
}

interface CategoryMapping {
  euCategory: Category;
  euSpecifications?: CategorySpecification[];
  defaultGround: 'ILLEGAL_CONTENT' | 'INCOMPATIBLE_CONTENT';
  legalGround?: string;
  defaultExplanation?: string;
}
```

---

## Notice Engine Module

`import { ... } from 'eu-dsa/notice'`

### NoticeStateMachine

Configurable state machine for DSA Art. 16 notice-and-action workflow.

```ts
new NoticeStateMachine(config?: NoticeStateMachineConfig)
```

| Method | Returns | Description |
|--------|---------|-------------|
| `getValidTransitions(notice)` | `NoticeState[]` | Valid next states |
| `canTransition(notice, to)` | `boolean` | Check if transition is valid |
| `transition(notice, to)` | `Promise<Notice>` | Execute transition (throws on invalid) |

#### NoticeState

`RECEIVED` → `ACKNOWLEDGED` → `ASSESSING` → `DECIDED_ACTION_TAKEN` | `DECIDED_NO_ACTION` | `DECIDED_PARTIAL_ACTION` → `CLOSED`

Side paths: `ASSESSING` → `ESCALATED`, `DECIDED_*` → `APPEALED`

### createNotice

```ts
createNotice(params: {
  id?: string;
  source: NoticeSource;
  content: { contentId: string; contentType: string; contentUrl?: string; snapshot?: ContentSnapshot };
  classification: NoticeClassification;
  priority?: number;
  territorialScope?: TerritorialScopeCode[];
  metadata?: Record<string, unknown>;
}): Notice
```

### Deadline Functions

```ts
calculateDeadline(referenceDate: Date, type: DeadlineType, config?: DeadlineConfig): Deadline
getNoticeDeadlines(notice: Notice, options?: { isManifestlyIllegal?; isNetzDGApplicable?; config? }): Deadline[]
getDeadlineAlerts(notice: Notice, options?): Deadline[]  // Only approaching/expired
```

**DeadlineType**: `NETZDG_24H` | `NETZDG_7D` | `DSA_ACKNOWLEDGMENT` | `APPEAL_WINDOW`

### Trusted Flagger

```ts
calculatePriority(basePriority: number, isTrustedFlagger: boolean, config?: TrustedFlaggerConfig): number
evaluateFlaggerStatus(stats: FlaggerStats, config?: TrustedFlaggerConfig): FlaggerEvaluation
applyCommunityBonus(basePriority: number, reporterCount: number, options?: {
  bonusPerReporter?: number;  // default: 5
  maxBonus?: number;          // default: 25
  minimumBasePriority?: number; // default: 20
}): number
```

---

## Appeals Module

`import { ... } from 'eu-dsa/appeals'`

### AppealWorkflow

State machine for DSA Art. 20 internal complaint-handling.

```ts
new AppealWorkflow(config?: AppealWorkflowConfig)
```

| Method | Description |
|--------|-------------|
| `submit(params: AppealCreateParams)` | Create appeal (validates window) |
| `assign(appeal, reviewerId)` | Assign reviewer (enforces different-reviewer rule) |
| `startReview(appeal, reviewerId)` | Start review |
| `resolve(appeal, reviewerId, outcome)` | Resolve with outcome |
| `close(appeal)` | Close after notifying appellant |
| `getValidTransitions(appeal)` | Get valid next states |

**AppealState**: `SUBMITTED` → `ASSIGNED` → `UNDER_REVIEW` → `RESOLVED` → `CLOSED`

**AppealOutcomeResult**: `UPHELD` | `PARTIALLY_UPHELD` | `REJECTED`

### Window Functions

```ts
isAppealWindowOpen(decisionDate: Date, config?: AppealWindowConfig): boolean
getAppealWindowStatus(decisionDate: Date, config?): AppealWindowStatus
calculateAppealWindowEnd(decisionDate: Date, config?): Date
```

Default window: 180 days (6 months per DSA Art. 20(1)).

---

## Events Module

`import { ... } from 'eu-dsa/events'`

### createDsaEventEmitter

```ts
createDsaEventEmitter(options?: { maxListeners?: number }): DsaEventEmitter
```

| Method | Description |
|--------|-------------|
| `on(event, handler)` | Subscribe to an event |
| `once(event, handler)` | Subscribe once |
| `off(event, handler)` | Unsubscribe |
| `emit(event, payload)` | Emit an event |
| `removeAllListeners(event?)` | Remove all listeners |
| `listenerCount(event)` | Get listener count |

### Event Types

| Event | Payload |
|-------|---------|
| `sor.validated` | `{ submission }` |
| `sor.submitted` | `{ submission, response }` |
| `sor.submission_failed` | `{ submission, error }` |
| `sor.batch_submitted` | `{ count, succeeded, failed }` |
| `sor.queued` | `{ statement }` |
| `sor.queue_flushed` | `{ submitted, failed }` |
| `notice.received` | `{ noticeId, category }` |
| `notice.acknowledged` | `{ noticeId }` |
| `notice.state_changed` | `{ noticeId, from, to, actorId? }` |
| `notice.decided` | `{ noticeId, decision }` |
| `notice.deadline_warning` | `{ noticeId, deadlineType, remainingMs }` |
| `notice.deadline_expired` | `{ noticeId, deadlineType }` |
| `appeal.submitted` | `{ appealId, appellantId }` |
| `appeal.assigned` | `{ appealId, reviewerId }` |
| `appeal.resolved` | `{ appealId, outcome }` |
| `appeal.window_expiring` | `{ statementReference, expiresAt }` |
| `report.generated` | `{ period, tier }` |
| `report.exported` | `{ format }` |
| `api.rate_limited` | `{ retryAfterMs }` |
| `api.error` | `{ error, endpoint }` |
| `storage.error` | `{ error, operation }` |

---

## Reports Module

`import { ... } from 'eu-dsa/reports'`

### TransparencyReportGenerator

Generates transparency reports per Implementing Regulation (EU) 2024/2835.

```ts
createReportGenerator(config: ReportGeneratorConfig): TransparencyReportGenerator

interface ReportGeneratorConfig {
  platformName: string;
  legalEntity: string;
  platformUrl: string;
  tierConfig: { tier: DsaTier; isSmallEnterprise: boolean };
  contactEmail?: string;
}
```

##### `generate(provider: TransparencyDataProvider, period: ReportingPeriod): Promise<TransparencyReport>`

**DsaTier**: `INTERMEDIARY` | `PLATFORM` | `VLOP`

Tier-aware part inclusion:

| Part | INTERMEDIARY | PLATFORM | VLOP |
|------|:-----------:|:--------:|:----:|
| 3: Authority orders | yes | yes | yes |
| 4: Notices | - | yes | yes |
| 5: Own initiative (illegal) | yes | yes | yes |
| 6: TOS violations | - | yes | yes |
| 7: Complaints | - | yes | yes |
| 8: Automated means | yes | yes | yes |
| 9: Human resources | - | - | yes |
| 10: AMAR | yes | yes | yes |
| 11: Qualitative | yes | yes | yes |

### Formatters

```ts
toCSV(report: TransparencyReport): CSVParts
toJSON(report: TransparencyReport): string
toMarkdown(report: TransparencyReport): string
```

`CSVParts` contains one string per report part: `part1_identification`, `part3_orders`, `part4_notices?`, `part5_own_initiative_illegal`, `part6_own_initiative_tos?`, `part7_complaints?`, `part8_automation`, `part9_human_resources?`, `part10_amar`, `part11_qualitative`.

---

## Storage Module

`import { ... } from 'eu-dsa/storage'`

### StorageAdapter Interface

Database-agnostic persistence for notices, appeals, and queued statements.

```ts
interface StorageAdapter {
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
```

### createInMemoryStorage

```ts
createInMemoryStorage(): StorageAdapter
```

In-memory implementation for testing and prototyping. Data is lost when the process exits.

### Filter Types

```ts
interface NoticeFilters {
  state?: NoticeState | NoticeState[];
  sourceType?: string;
  isTrustedFlagger?: boolean;
  contentId?: string;
  assignedTo?: string;
  receivedAfter?: Date;
  receivedBefore?: Date;
}

interface AppealFilters {
  state?: AppealState | AppealState[];
  appellantId?: string;
  assignedReviewer?: string;
  submittedAfter?: Date;
  submittedBefore?: Date;
}

interface ListOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```
