# Architecture

## Overview

dsa-toolkit is a modular TypeScript library for EU Digital Services Act compliance. It has a single runtime dependency (Zod) and ships as ESM-only with 9 subpath exports.

## Module Dependency Graph

```
  schemas (foundation — Zod enums, validation, types)
     │
     ├──────────────────┬──────────────────────┐
     ▼                  ▼                      ▼
   sor              api/client             notice
  (builder,         (HTTP client,          (state machine,
   mapper,           errors,               deadlines,
   PUID,             retry,                trusted flagger)
   pseudonymize)     queue,                    │
     │               interceptors)             ▼
     │                                     appeals
     ▼                                     (workflow,
   api/errors                               window)
  (DsaValidationError
   used by builder)

  events ← api types (event payloads reference SorSubmission, QueuedStatement)

  reports ← notice/appeal types (report data types reference Notice, Appeal)

  storage ← notice/appeal/queue types (adapter persists all domain objects)
```

**Key principle:** Schemas is the foundation with zero internal dependencies. Every other module depends on schemas but not on each other (with the exception of SoR builder importing `DsaValidationError` from api/errors).

## Data Flow

### Statement of Reasons Submission

```
1. Platform code
       │
       ▼
2. SoRBuilder  ──────────────────────────────  PlatformMapper
   (fluent API)                                (optional: pre-fills
       │                                        category, ground, etc.)
       ▼
3. .build() ── sorSubmissionSchema (Zod) ──→ ValidatedSorSubmission
       │
       ▼
4. TransparencyDatabaseClient.submitStatement()
       │
       ├── Request interceptors (audit logging, custom headers)
       ├── HTTP POST to EU Transparency Database API
       ├── Retry with exponential backoff (on 408/429/500-504)
       ├── Response interceptors
       └── Rate limit header parsing
       │
       ▼
5. SorSubmissionResponse (uuid, id, permalink)
```

### Notice-and-Action Flow

```
1. Report received (Art. 16 notice, trusted flagger, authority order)
       │
       ▼
2. createNotice() → Notice { state: RECEIVED }
       │
       ▼
3. NoticeStateMachine.transition()
       │
   RECEIVED → ACKNOWLEDGED → ASSESSING → DECIDED_* → CLOSED
                                 │              │
                                 ▼              ▼
                             ESCALATED      APPEALED
       │
       ▼
4. getNoticeDeadlines() tracks NetzDG/DSA statutory timelines
5. calculatePriority() applies trusted flagger multiplier
6. Events emitted at each state change
```

### Appeal Workflow

```
1. Appellant files complaint within 6-month window
       │
       ▼
2. AppealWorkflow.submit() → validates window, creates Appeal { state: SUBMITTED }
       │
       ▼
3. .assign(reviewerId) → enforces different-reviewer rule (Art. 20(4))
       │
       ▼
4. .startReview() → .resolve(outcome) → .close()
       │
       ▼
5. SUBMITTED → ASSIGNED → UNDER_REVIEW → RESOLVED → CLOSED
```

### Transparency Report Generation

```
1. Platform implements TransparencyDataProvider interface
       │
       ▼
2. createReportGenerator(config) → TransparencyReportGenerator
       │
       ▼
3. generator.generate(provider, period)
   - Calls provider methods for each report part
   - Tier-aware: skips parts not applicable to platform tier
       │
       ▼
4. TransparencyReport object
       │
       ├── toCSV(report)      → CSVParts (11 CSV strings)
       ├── toJSON(report)     → JSON string
       └── toMarkdown(report) → Markdown string
```

## Extension Points

### 1. StorageAdapter
Implement `StorageAdapter` from `dsa-toolkit/storage` for your database. The interface has 3 sub-adapters (`notices`, `appeals`, `queue`) with standard CRUD + filtering. `createInMemoryStorage()` ships with core for testing.

### 2. TransparencyDataProvider
Implement this interface to feed your platform's data into the report generator. Each method corresponds to one or more report parts. Query your database and return the structured data.

### 3. Request/Response Interceptors
Add middleware to the API client for audit logging, custom authentication, request tracing, etc. Request interceptors can modify headers/body. Response interceptors observe but don't modify.

### 4. State Machine Transitions
Pass custom `transitions[]` to `NoticeStateMachine` to add or remove states. Each transition can have a `guard` function and an `onTransition` callback.

### 5. Platform Mapper
Use `createPlatformMapper()` to bridge your platform's category taxonomy to EU API categories. The mapper pre-fills a `SoRBuilder` with category, specifications, grounds, content types, and territorial scope.

### 6. PUID Strategies
Four generation strategies for different use cases:
- `deterministicPuid`: Reproducible from platform + action + reference
- `randomPuid`: UUID-based for unique-per-submission
- `hashedPuid`: SHA-256 for privacy-preserving deduplication
- `timestampPuid`: Date-prefixed for chronological ordering

### 7. Deadline Configuration
Override default deadlines via `DeadlineConfig` (NetzDG 24h/7d, DSA acknowledgment, appeal window).

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single runtime dep (Zod) | Minimal footprint for a compliance library |
| ESM-only | Tree-shaking, modern Node.js (18+) |
| Fluent builder (SoRBuilder) | SoR construction has 15+ fields — fluent API is readable |
| State machines (Notice, Appeal) | DSA mandates specific workflows; state machines enforce valid transitions |
| Interface-based storage | Database-agnostic; platforms choose their own persistence |
| `as const` enums | Tree-shakeable, no runtime enum overhead, full type narrowing |
| Typed event emitter | Compile-time safety for 21 event types |
| Subpath exports | Selective imports reduce bundle size |

## File Organization

```
src/
├── index.ts              Main barrel (re-exports from all modules)
├── schemas/
│   ├── enums.ts          160+ EU API enum values
│   ├── api-types.ts      Request/response types
│   ├── sor-schema.ts     Zod validation with conditional rules
│   └── index.ts          Barrel
├── api/
│   ├── client.ts         TransparencyDatabaseClient
│   ├── errors.ts         Error class hierarchy
│   ├── interceptors.ts   Request/response interceptor types
│   ├── retry.ts          Exponential backoff with jitter
│   ├── queue.ts          Offline queue interface + InMemoryQueue
│   └── index.ts          Barrel
├── sor/
│   ├── builder.ts        SoRBuilder fluent API
│   ├── mapper.ts         Platform category mapper
│   ├── puid.ts           PUID generation strategies
│   ├── pseudonymize.ts   GDPR pseudonymization utilities
│   └── index.ts          Barrel
├── notice/
│   ├── types.ts          Notice, NoticeState, related types
│   ├── state-machine.ts  NoticeStateMachine + createNotice
│   ├── deadlines.ts      Deadline calculator
│   ├── trusted-flagger.ts Art. 22 trusted flagger logic
│   └── index.ts          Barrel
├── appeals/
│   ├── types.ts          Appeal, AppealState, related types
│   ├── workflow.ts       AppealWorkflow state machine
│   ├── window.ts         6-month window calculator
│   └── index.ts          Barrel
├── events/
│   ├── types.ts          DsaEventMap (21 event definitions)
│   ├── emitter.ts        Typed EventEmitter wrapper
│   └── index.ts          Barrel
├── reports/
│   ├── types.ts          TransparencyReport and all part types
│   ├── aggregator.ts     TransparencyDataProvider interface
│   ├── generator.ts      TransparencyReportGenerator
│   ├── formatters.ts     CSV, JSON, Markdown output
│   └── index.ts          Barrel
└── storage/
    ├── adapter.ts        StorageAdapter interface
    ├── memory.ts         InMemoryStorage implementation
    └── index.ts          Barrel
```
