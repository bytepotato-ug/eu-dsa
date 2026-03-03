# dsa-toolkit

> Open-source EU Digital Services Act compliance toolkit for Node.js platforms.

The EU Digital Services Act has been fully enforceable since February 2024. Every online platform serving EU users must submit Statements of Reasons to the EU Transparency Database, generate standardized transparency reports, implement notice-and-action mechanisms, and handle appeals — all with statutory deadlines.

**There are 2M+ npm packages. Until now, zero addressed the DSA.**

`dsa-toolkit` is the first open-source developer toolkit for DSA compliance. It handles the technical obligations so you can focus on building your platform.

## Install

```bash
npm install dsa-toolkit
```

Requires Node.js 18+. TypeScript-first with full type safety. ESM-only.

## Quick Start: Submit a Statement of Reasons

```typescript
import {
  TransparencyDatabaseClient,
  SoRBuilder,
  deterministicPuid,
} from 'dsa-toolkit';

const client = new TransparencyDatabaseClient({
  token: process.env.EU_TRANSPARENCY_TOKEN!,
  sandbox: process.env.NODE_ENV !== 'production',
});

const sor = new SoRBuilder()
  .puid(deterministicPuid({
    platform: 'myapp',
    actionType: 'mod',
    referenceId: 'rpt-123',
  }))
  .contentRemoved()
  .illegalContent('§130 StGB', 'Incitement to hatred targeting ethnic minority group')
  .contentType('TEXT')
  .category('ILLEGAL_OR_HARMFUL_SPEECH')
  .dates({ content: '2024-06-15', application: '2024-06-16' })
  .facts('Content contained explicit incitement to hatred against an ethnic group.')
  .source('ARTICLE_16')
  .automatedDetection(true)
  .automatedDecision('PARTIALLY')
  .territorialScope(['DE'])
  .build();

const result = await client.submitStatement(sor);
console.log(`Submitted: ${result.uuid}`);
```

## Batch Submission

```typescript
import { TransparencyDatabaseClient, SoRBuilder, randomPuid } from 'dsa-toolkit';

const client = new TransparencyDatabaseClient({
  token: process.env.EU_TRANSPARENCY_TOKEN!,
});

const statements = moderationDecisions.map((decision) =>
  new SoRBuilder()
    .puid(randomPuid('myapp'))
    .contentRemoved()
    .illegalContent(decision.legalGround, decision.explanation)
    .contentType('TEXT')
    .category('ILLEGAL_OR_HARMFUL_SPEECH')
    .dates({ content: decision.contentDate, application: decision.decisionDate })
    .facts(decision.facts)
    .source('ARTICLE_16')
    .automatedDetection(decision.aiDetected)
    .automatedDecision(decision.aiDecided ? 'PARTIALLY' : 'NOT_AUTOMATED')
    .build()
);

// Auto-chunks into 100-item batches per EU API limits
const result = await client.submitStatements(statements);
console.log(`Submitted ${result.statements.length} statements`);
```

## Platform Category Mapping

Map your internal moderation categories to the EU's standardized taxonomy:

```typescript
import {
  createPlatformMapper,
  SoRBuilder,
  Category,
  CategorySpecification,
  ContentType,
} from 'dsa-toolkit';

const mapper = createPlatformMapper({
  platformName: 'myapp',
  categories: {
    hate_speech: {
      euCategory: Category.ILLEGAL_OR_HARMFUL_SPEECH,
      euSpecifications: [CategorySpecification.HATE_SPEECH, CategorySpecification.INCITEMENT_VIOLENCE_HATRED],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: '§130 StGB',
    },
    terrorism: {
      euCategory: Category.RISK_FOR_PUBLIC_SECURITY,
      euSpecifications: [CategorySpecification.TERRORIST_CONTENT],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: 'EU Reg 2021/784',
    },
    spam: {
      euCategory: Category.SCAMS_AND_FRAUD,
      defaultGround: 'INCOMPATIBLE_CONTENT',
    },
  },
  defaultContentTypes: [ContentType.TEXT],
  defaultTerritorialScope: ['DE'],
});

const builder = new SoRBuilder();
mapper(builder, 'hate_speech');
// Builder is now pre-populated with EU category, specifications, and legal ground
```

## PUID Generation

Every Statement of Reasons needs a Platform-Unique Identifier (PUID):

```typescript
import {
  deterministicPuid,
  randomPuid,
  hashedPuid,
  timestampPuid,
  isValidPuid,
} from 'dsa-toolkit';

// Deterministic — same inputs always produce the same PUID
deterministicPuid({ platform: 'myapp', actionType: 'mod', referenceId: '123' });
// → 'myapp-mod-123'

// Random — UUID-based
randomPuid('myapp');
// → 'myapp-a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// Hashed — SHA-256 prefix for privacy
await hashedPuid('myapp', 'user-42', 'post-789');
// → 'myapp-a1b2c3d4e5f67890'

// Timestamp-based
timestampPuid('myapp');
// → 'myapp-20240616-a1b2c3d4'

// Validate any PUID
isValidPuid('myapp-mod-123'); // true
isValidPuid('invalid puid!'); // false (spaces and special chars not allowed)
```

## GDPR Pseudonymization

Strip personal data before submitting SoRs to the EU Transparency Database:

```typescript
import {
  pseudonymizeUserId,
  sanitizeForSubmission,
  stripIpAddresses,
  stripEmails,
} from 'dsa-toolkit';

// Hash user IDs
const anonId = pseudonymizeUserId('user-42', { salt: process.env.PSEUDO_SALT! });
// → 'user_a1b2c3d4e5f6'

// Strip all PII from free-text fields in one pass
const cleanText = sanitizeForSubmission(
  'User john@example.com (IP: 192.168.1.1) posted hate speech mentioning @victim',
  { stripIps: true, stripEmailAddresses: true, stripUserMentions: true }
);
// → 'User [EMAIL_REDACTED] (IP: [IP_REDACTED]) posted hate speech mentioning [USER_REDACTED]'
```

## Offline Queue

Handle API downtime gracefully with automatic queuing:

```typescript
import { TransparencyDatabaseClient, InMemoryQueue } from 'dsa-toolkit';

const client = new TransparencyDatabaseClient({
  token: process.env.EU_TRANSPARENCY_TOKEN!,
});

const queue = new InMemoryQueue();
client.setQueue(queue);

// Automatically queues on retryable errors (503, timeout, etc.)
const result = await client.submitOrQueue(sor);
if ('status' in result && result.status === 'pending') {
  console.log('API unavailable, statement queued for retry');
}

// Later, flush the queue
const { submitted, failed } = await client.flushQueue();
```

## Interceptors (Audit Logging)

Log every API call for compliance audit trails:

```typescript
import { TransparencyDatabaseClient } from 'dsa-toolkit';

const client = new TransparencyDatabaseClient({
  token: process.env.EU_TRANSPARENCY_TOKEN!,
  interceptors: {
    request: [(ctx) => {
      console.log(`[DSA] ${ctx.method} ${ctx.url} requestId=${ctx.requestId}`);
      return ctx;
    }],
    response: [(ctx) => {
      console.log(`[DSA] ${ctx.statusCode} in ${ctx.durationMs}ms requestId=${ctx.requestId}`);
    }],
  },
});
```

## Event System

React to DSA lifecycle events:

```typescript
import { createDsaEventEmitter } from 'dsa-toolkit';

const emitter = createDsaEventEmitter();

emitter.on('sor.submitted', ({ submission, response }) => {
  console.log(`SoR ${response.uuid} submitted for PUID ${submission.puid}`);
});

emitter.on('sor.submission_failed', ({ submission, error }) => {
  alertOps(`SoR submission failed for ${submission.puid}: ${error.message}`);
});

emitter.on('api.rate_limited', ({ retryAfterMs }) => {
  console.warn(`Rate limited, retry after ${retryAfterMs}ms`);
});
```

## Error Handling

All errors are typed with programmatic `code` fields:

```typescript
import {
  DsaValidationError,
  DsaApiError,
  DsaAuthError,
  DsaPuidConflictError,
  DsaRateLimitError,
  DsaNetworkError,
} from 'dsa-toolkit';

try {
  await client.submitStatement(sor);
} catch (err) {
  if (err instanceof DsaValidationError) {
    // Zod validation failed before API call
    console.error('Invalid SoR:', err.fieldErrors);
  } else if (err instanceof DsaPuidConflictError) {
    // PUID already exists — skip or update
    console.warn(`Duplicate PUID: ${err.puid}`);
  } else if (err instanceof DsaAuthError) {
    // 401/403 — check your API token
    console.error('Auth failed:', err.message);
  } else if (err instanceof DsaRateLimitError) {
    // 429 — retry after delay
    console.warn(`Rate limited, retry after ${err.retryAfterMs}ms`);
  } else if (err instanceof DsaNetworkError) {
    // Timeout or connection error
    console.error('Network error:', err.message);
  } else if (err instanceof DsaApiError) {
    // Other API error (422, 500, etc.)
    console.error(`API error ${err.statusCode}:`, err.message);
  }
}
```

## What This Library Covers vs. What You Build

`dsa-toolkit` handles the **protocol layer** — talking to the EU, validating data, building compliant submissions. Your platform still needs application-level code to tie it all together.

| Layer | dsa-toolkit provides | You build |
|-------|---------------------|-----------|
| **EU API** | HTTP client, auth, retries, rate limiting, batch chunking | Client initialization, API token management |
| **Statements of Reasons** | `SoRBuilder` fluent API, Zod validation, 160+ EU enums | Database schema, SoR creation logic, user notification |
| **Category Mapping** | `createPlatformMapper()`, full EU taxonomy | Mapping your categories to EU categories |
| **GDPR** | `sanitizeForSubmission()`, IP/email/mention stripping | Deciding what fields to sanitize |
| **Submission** | Submit/batch/queue to EU Transparency Database | Background job queue (BullMQ, SQS, etc.), error recovery |
| **Notices (Art. 16)** | State machine, deadline calculator, priority scoring | Database persistence, admin review UI |
| **Appeals (Art. 20)** | Workflow state machine, 6-month window calculator | Complaint database, different-reviewer enforcement, user notification |
| **Trusted Flaggers (Art. 22)** | Priority multiplier, accuracy evaluation | Accuracy tracking in your database, status management |
| **Reports (Art. 15/24)** | Report generator, CSV/JSON/Markdown formatters | `TransparencyDataProvider` implementation (queries your database) |

**In short**: `dsa-toolkit` is ~20% of the work. The remaining ~80% is application code specific to your platform, database, and infrastructure.

See the [Integration Guide](docs/INTEGRATION-GUIDE.md) for a step-by-step walkthrough with code examples, and the [example Prisma schema](examples/prisma-schema.prisma) for a ready-to-copy database schema.

## What's Covered

| DSA Article | Obligation | Module | Status |
|-------------|-----------|--------|--------|
| Art. 17 | Statement of Reasons | `sor/` | ✅ v0.1.0 |
| Art. 24(5) | Submit SoRs to EU Transparency Database | `api/` | ✅ v0.1.0 |
| Art. 16 | Notice-and-action mechanism | `notice/` | ✅ v0.2.0 |
| Art. 20 | Internal complaint-handling | `appeals/` | ✅ v0.2.0 |
| Art. 22 | Trusted flagger processing | `notice/` | ✅ v0.2.0 |
| Art. 15/24/42 | Transparency reports | `reports/` | ✅ v0.5.0 |

## Subpath Exports

Import only what you need:

```typescript
import { TransparencyDatabaseClient } from 'dsa-toolkit/api';
import { SoRBuilder } from 'dsa-toolkit/sor';
import { sorSubmissionSchema } from 'dsa-toolkit/schemas';
import { createDsaEventEmitter } from 'dsa-toolkit/events';
```

## Links

- [EU Digital Services Act (full text)](https://eur-lex.europa.eu/eli/reg/2022/2065)
- [EU Transparency Database](https://transparency.dsa.ec.europa.eu/)
- [Transparency Database API Documentation](https://transparency.dsa.ec.europa.eu/page/api-documentation)
- [Implementing Regulation 2024/2835 (reporting templates)](https://eur-lex.europa.eu/eli/reg_impl/2024/2835/oj/eng)

## Roadmap

- [x] v0.1.0 — Core schemas, API client, SoR builder, PUID generation, pseudonymization, platform mapper
- [x] v0.2.0 — Notice engine, appeals handler, event system integration, storage adapter
- [x] v0.5.0 — Transparency reports (CSV/JSON/Markdown per EU template), typed event emitter
- [x] v1.0.0 — Stable API, 97%+ test coverage, full documentation, integration guide
- [ ] Post-1.0 — Express/Fastify middleware, Prisma storage adapter, Mastodon adapter

## License

MIT

## Disclaimer

This package automates the technical obligations of the EU Digital Services Act (Regulation (EU) 2022/2065). It does not constitute legal advice and does not replace consultation with qualified legal professionals. Compliance with the DSA requires organizational, legal, and technical measures — this package addresses only the technical components. You are responsible for ensuring your platform's overall compliance with applicable laws.
