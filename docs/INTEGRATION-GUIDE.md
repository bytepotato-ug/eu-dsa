# Integration Guide

Step-by-step guide to integrating `dsa-toolkit` into a production platform. Based on a real-world implementation in a Node.js + Express + Prisma + BullMQ stack.

> This guide assumes you've already `npm install dsa-toolkit` and are familiar with the [Quick Start](../README.md#quick-start-submit-a-statement-of-reasons) in the README. Here we cover everything else you need to build.

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Environment Setup](#2-environment-setup)
3. [Client Initialization](#3-client-initialization)
4. [Category Mapping](#4-category-mapping)
5. [Creating Statements of Reasons](#5-creating-statements-of-reasons)
6. [Submitting to the EU](#6-submitting-to-the-eu)
7. [Error Handling in Production](#7-error-handling-in-production)
8. [Background Queue](#8-background-queue)
9. [Complaint Handling (Art. 20)](#9-complaint-handling-art-20)
10. [Trusted Flaggers (Art. 22)](#10-trusted-flaggers-art-22)
11. [Transparency Reports (Art. 15/24)](#11-transparency-reports-art-1524)

---

## 1. Database Schema

You need database tables for:

- **StatementOfReasons** — stores every moderation decision notification (DSA Art. 17)
- **Complaint** — stores user appeals/complaints (DSA Art. 20)
- **User fields** — trusted flagger status (Art. 22) and repeat offender tracking (Art. 23)
- **Report fields** — trusted flagger flag on content reports

See [`examples/prisma-schema.prisma`](../examples/prisma-schema.prisma) for a complete, ready-to-copy Prisma schema with all fields and indexes.

Key fields on `StatementOfReasons` that are required by DSA Art. 17(3):

| Field | DSA Requirement | Example |
|-------|----------------|---------|
| `factsCircumstances` | What content/behavior led to the decision | "Post contained incitement to hatred..." |
| `legalGround` | Legal provision or Terms section relied upon | "§130 StGB (DE); Community Guidelines" |
| `groundExplanation` | Why the ground applies to the specific facts | "Content explicitly targets ethnic group..." |
| `automatedInfo` | Whether automated tools were used | "AI-assisted detection at 92% confidence" |
| `redressInfo` | How to appeal (internal + out-of-court options) | See template below |

EU submission tracking fields (not DSA-mandated, but needed for production):

| Field | Purpose |
|-------|---------|
| `euSubmittedAt` | When successfully submitted to EU |
| `euPuid` | Platform-Unique ID assigned by your platform |
| `euSubmissionId` | ID returned by EU API |
| `euSubmissionUuid` | UUID returned by EU API |
| `euSubmissionError` | Last error message (for debugging) |
| `euSubmissionAttempts` | Retry counter |

---

## 2. Environment Setup

You need three environment variables:

```bash
# Enable/disable EU submissions (keep false in development)
DSA_EU_SUBMISSIONS_ENABLED=false

# API token from the EU Transparency Database portal
# Get yours at: https://transparency.dsa.ec.europa.eu/
DSA_EU_API_TOKEN=

# Optional: override the base URL (for testing against a mock server)
# DSA_EU_API_BASE_URL=http://localhost:9999
```

Validate at startup:

```typescript
if (process.env.DSA_EU_SUBMISSIONS_ENABLED === 'true' && !process.env.DSA_EU_API_TOKEN) {
  throw new Error('DSA_EU_API_TOKEN is required when EU submissions are enabled');
}
```

---

## 3. Client Initialization

Use a singleton pattern — create one client instance and reuse it:

```typescript
import { TransparencyDatabaseClient } from 'dsa-toolkit';

let client: TransparencyDatabaseClient | null = null;

export function getDsaClient(): TransparencyDatabaseClient {
  if (!client) {
    client = new TransparencyDatabaseClient({
      token: process.env.DSA_EU_API_TOKEN!,
      baseUrl: process.env.DSA_EU_API_BASE_URL, // undefined = production EU endpoint
      timeoutMs: 30_000,
      retry: { maxAttempts: 1 }, // Set to 1 if your job queue handles retries
      userAgent: 'yourplatform/1.0 dsa-toolkit/1.0.0',
    });
  }
  return client;
}
```

**Why `maxAttempts: 1`?** If you use a job queue (BullMQ, SQS, etc.) for retries, let the queue handle retry logic. The dsa-toolkit client's built-in retry is for simple scripts without a queue.

---

## 4. Category Mapping

Every platform has its own moderation categories. The EU has a standardized taxonomy. You need to bridge them.

Use `createPlatformMapper()` to define the mapping once:

```typescript
import {
  createPlatformMapper,
  Category,
  CategorySpecification,
  ContentType,
} from 'dsa-toolkit';

// Define your platform's categories as a union type or enum
type MyCategory = 'HATE_SPEECH' | 'TERRORISM' | 'SPAM' | 'COPYRIGHT' | 'HARASSMENT' | 'OTHER';

export const applyCategory = createPlatformMapper<MyCategory>({
  platformName: 'myplatform',
  defaultTerritorialScope: ['DE'], // Your primary jurisdiction
  categories: {
    HATE_SPEECH: {
      euCategory: Category.ILLEGAL_OR_HARMFUL_SPEECH,
      euSpecifications: [CategorySpecification.HATE_SPEECH],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: '§130 StGB (DE)',
      defaultExplanation: 'Content constitutes incitement to hatred.',
    },
    TERRORISM: {
      euCategory: Category.RISK_FOR_PUBLIC_SECURITY,
      euSpecifications: [CategorySpecification.TERRORIST_CONTENT],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: 'EU Regulation 2021/784; §129a StGB (DE)',
      defaultExplanation: 'Content relates to terrorist activity.',
    },
    SPAM: {
      euCategory: Category.SCAMS_AND_FRAUD,
      defaultGround: 'INCOMPATIBLE_CONTENT',
      legalGround: 'Community Guidelines - No Spam',
      defaultExplanation: 'Content identified as spam or fraud.',
    },
    COPYRIGHT: {
      euCategory: Category.INTELLECTUAL_PROPERTY_INFRINGEMENTS,
      euSpecifications: [CategorySpecification.COPYRIGHT_INFRINGEMENT],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: 'Directive 2001/29/EC',
      defaultExplanation: 'Content infringes copyright.',
    },
    HARASSMENT: {
      euCategory: Category.CYBER_VIOLENCE,
      euSpecifications: [CategorySpecification.CYBER_BULLYING_INTIMIDATION],
      defaultGround: 'INCOMPATIBLE_CONTENT',
      legalGround: 'Community Guidelines - Respectful Conduct',
      defaultExplanation: 'Content constitutes targeted harassment.',
    },
    OTHER: {
      euCategory: Category.OTHER_VIOLATION_TC,
      defaultGround: 'INCOMPATIBLE_CONTENT',
      legalGround: 'Community Guidelines',
      defaultExplanation: 'Content violates terms of service.',
    },
  },
  defaultContentTypes: [ContentType.TEXT],
});
```

Then use it when building a Statement of Reasons:

```typescript
const builder = new SoRBuilder();
applyCategory(builder, 'HATE_SPEECH');
// Builder now has: category, specifications, ground, legal reference, explanation, territorial scope
```

**Choosing between `ILLEGAL_CONTENT` and `INCOMPATIBLE_CONTENT`:**
- `ILLEGAL_CONTENT` — content that violates a specific law (criminal code, copyright directive, etc.)
- `INCOMPATIBLE_CONTENT` — content that violates your Terms of Service but isn't necessarily illegal

---

## 5. Creating Statements of Reasons

DSA Art. 17 requires you to notify users whenever you take a moderation action. Create a service that generates these notifications:

```typescript
import { deterministicPuid } from 'dsa-toolkit';

// Standard redress information — same for every statement
const REDRESS_INFO = `You have the right to contest this decision:

1. INTERNAL COMPLAINT (DSA Art. 20)
   Submit a complaint to support@yourplatform.com within 6 months.
   Your complaint will be reviewed by a staff member not involved in the original decision.

2. OUT-OF-COURT DISPUTE RESOLUTION (DSA Art. 21)
   You may pursue out-of-court dispute resolution through a certified body
   under the Digital Services Act.

3. JUDICIAL REMEDIES
   You retain the right to seek remedies through courts.`;

// Generate a unique reference number
function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return 'SOR-' + year + '-' + random;
}

// Generate a deterministic PUID for EU submission
function generatePuid(referenceNumber: string, decisionType: string): string {
  return deterministicPuid({
    platform: 'myplatform',
    actionType: decisionType.toLowerCase().replace(/_/g, '-'),
    referenceId: referenceNumber,
  });
}
```

When an admin removes content:

```typescript
async function createContentDecisionStatement(params: {
  authorId: string;
  postId: string;
  reportId?: string;
  decisionType: 'CONTENT_REMOVED' | 'CONTENT_HIDDEN' | 'CONTENT_RESTRICTED';
  category: string;
  legalReference?: string;
  wasAutomated: boolean;
  aiConfidence?: number;
}) {
  const referenceNumber = generateReferenceNumber();

  // Build the required DSA Art. 17(3) fields
  const factsCircumstances =
    'Your content (Post ID: ' + params.postId + ') was reviewed ' +
    (params.reportId ? 'following a user report. ' : 'as part of our moderation process. ') +
    'Found to potentially violate policies regarding: ' + params.category;

  const legalGround = 'Community Guidelines - ' + params.category +
    (params.legalReference ? '; ' + params.legalReference : '');

  const groundExplanation =
    'After review, the content was determined to violate our Community Guidelines. ' +
    'The content has been ' +
    (params.decisionType === 'CONTENT_REMOVED' ? 'permanently removed.' : 'restricted.');

  let automatedInfo: string | null = null;
  if (params.wasAutomated) {
    automatedInfo = 'This decision was assisted by automated classification tools.';
    if (params.aiConfidence != null) {
      automatedInfo += ' Confidence: ' + Math.round(params.aiConfidence * 100) + '%.';
    }
    automatedInfo += ' A human moderator confirmed before action was taken.';
  }

  // Save to your database
  const statement = await db.statementOfReasons.create({
    data: {
      recipientId: params.authorId,
      recipientType: 'CONTENT_AUTHOR',
      decisionType: params.decisionType,
      contentId: params.postId,
      reportId: params.reportId ?? null,
      factsCircumstances,
      legalGround,
      groundExplanation,
      automatedInfo,
      redressInfo: REDRESS_INFO,
      referenceNumber,
      deliveryMethod: 'IN_APP',
    },
  });

  // Enqueue EU submission (see step 8)
  await enqueueDsaSubmission(statement.id, referenceNumber, params.decisionType);

  return statement;
}
```

---

## 6. Submitting to the EU

This is the core integration with dsa-toolkit. Fetch your statement from the database, build an SoR using the builder, and submit:

```typescript
import {
  SoRBuilder,
  ContentType,
  SourceType,
  AutomatedDecision,
  DecisionVisibility,
  DecisionAccount,
  sanitizeForSubmission,
} from 'dsa-toolkit';

async function submitStatementToEU(statementId: string): Promise<void> {
  const statement = await db.statementOfReasons.findById(statementId);
  if (!statement || statement.euSubmittedAt) return; // Already submitted or not found

  // Increment attempt counter
  await db.statementOfReasons.update(statementId, {
    euSubmissionAttempts: statement.euSubmissionAttempts + 1,
  });

  // Build the EU SoR
  const builder = new SoRBuilder();
  const puid = generatePuid(statement.referenceNumber, statement.decisionType);

  // 1. Category mapping
  applyCategory(builder, statement.category);

  // 2. Decision action
  switch (statement.decisionType) {
    case 'CONTENT_REMOVED':
      builder.visibility(DecisionVisibility.CONTENT_REMOVED);
      break;
    case 'CONTENT_HIDDEN':
    case 'CONTENT_RESTRICTED':
      builder.visibility(DecisionVisibility.CONTENT_DISABLED);
      break;
    case 'ACCOUNT_SUSPENDED':
      builder.account(DecisionAccount.SUSPENDED);
      break;
    case 'ACCOUNT_TERMINATED':
      builder.account(DecisionAccount.TERMINATED);
      break;
  }

  // 3. Legal ground (override mapper's default with actual SoR ground)
  const isIllegal = /§\d+|StGB|GDPR|Directive|Regulation/i.test(statement.legalGround);
  if (isIllegal) {
    builder.illegalContent(
      statement.legalGround.slice(0, 500),
      statement.groundExplanation.slice(0, 2000),
    );
  } else {
    builder.incompatibleContent(
      statement.legalGround.slice(0, 500),
      statement.groundExplanation.slice(0, 2000),
    );
  }

  // 4. Content type
  builder.contentType(ContentType.TEXT);

  // 5. Dates
  builder.dates({
    content: statement.contentCreatedAt?.toISOString().slice(0, 10) ?? statement.createdAt.toISOString().slice(0, 10),
    application: statement.createdAt.toISOString().slice(0, 10),
  });

  // 6. Facts — sanitize for GDPR before submitting to EU
  const sanitizedFacts = sanitizeForSubmission(statement.factsCircumstances, {
    stripIps: true,
    stripEmailAddresses: true,
    stripUserMentions: true,
  });
  builder.facts(sanitizedFacts.slice(0, 5000));

  // 7. Source type
  if (statement.reportId && statement.trustedFlagger) {
    builder.source(SourceType.TRUSTED_FLAGGER);
  } else if (statement.reportId) {
    builder.source(SourceType.ARTICLE_16);
  } else {
    builder.source(SourceType.VOLUNTARY);
  }

  // 8. Automation info
  if (statement.automatedInfo) {
    builder.automatedDetection(true);
    builder.automatedDecision(AutomatedDecision.PARTIALLY);
  } else {
    builder.automatedDetection(false);
    builder.automatedDecision(AutomatedDecision.NOT_AUTOMATED);
  }

  // 9. PUID and scope
  builder.puid(puid);
  builder.territorialScope(['DE']);

  // Submit
  const submission = builder.build();
  const client = getDsaClient();
  const response = await client.submitStatement(submission);

  // Update DB with success
  await db.statementOfReasons.update(statementId, {
    euSubmittedAt: new Date(),
    euPuid: puid,
    euSubmissionId: String(response.id),
    euSubmissionUuid: response.uuid,
    euSubmissionError: null,
  });
}
```

---

## 7. Error Handling in Production

dsa-toolkit throws specific error types. Each one needs a different response:

```typescript
import {
  DsaPuidConflictError,
  DsaAuthError,
  DsaValidationError,
  DsaRateLimitError,
  DsaApiError,
} from 'dsa-toolkit';

async function handleSubmissionError(statementId: string, error: unknown): Promise<void> {
  // PUID conflict — this statement was already submitted (idempotent recovery)
  if (error instanceof DsaPuidConflictError) {
    await db.statementOfReasons.update(statementId, {
      euSubmittedAt: new Date(),
      euPuid: error.puid,
      euSubmissionError: null,
    });
    return; // Job succeeds — no rethrow
  }

  // Auth error — your API token is invalid or expired. Do not retry.
  if (error instanceof DsaAuthError) {
    console.error('[DSA] Auth failed — check DSA_EU_API_TOKEN');
    await db.statementOfReasons.update(statementId, {
      euSubmissionError: 'Auth error: ' + error.message,
    });
    throw new UnrecoverableError(error.message); // BullMQ: don't retry
  }

  // Validation error — your data doesn't match the EU schema. Do not retry.
  if (error instanceof DsaValidationError) {
    const detail = JSON.stringify(error.fieldErrors);
    await db.statementOfReasons.update(statementId, {
      euSubmissionError: 'Validation: ' + detail,
    });
    throw new UnrecoverableError(detail); // BullMQ: don't retry
  }

  // Rate limited — the EU API wants you to slow down. Retry later.
  if (error instanceof DsaRateLimitError) {
    await db.statementOfReasons.update(statementId, {
      euSubmissionError: 'Rate limited',
    });
    throw error; // BullMQ: retry with backoff
  }

  // Network/5xx — transient error. Retry later.
  const message = error instanceof Error ? error.message : String(error);
  await db.statementOfReasons.update(statementId, {
    euSubmissionError: message.slice(0, 2000),
  });
  throw error; // BullMQ: retry with backoff
}
```

**Key principle**: Only retry transient errors (network, 5xx, rate limit). Never retry auth or validation errors — they won't fix themselves.

---

## 8. Background Queue

EU submissions should happen asynchronously. Don't block your admin's moderation action waiting for the EU API. Use a job queue.

### BullMQ Example

```typescript
import { Queue, Worker, UnrecoverableError } from 'bullmq';

const DSA_QUEUE = 'dsa-submissions';

interface DsaJobPayload {
  statementId: string;
  referenceNumber: string;
  decisionType: string;
}

// Create the queue
const dsaQueue = new Queue<DsaJobPayload>(DSA_QUEUE, {
  connection: redisClient,
});

// Enqueue a submission
export async function enqueueDsaSubmission(
  statementId: string,
  referenceNumber: string,
  decisionType: string,
) {
  if (process.env.DSA_EU_SUBMISSIONS_ENABLED !== 'true') return;

  await dsaQueue.add('submit', { statementId, referenceNumber, decisionType }, {
    attempts: 5,                          // Retry up to 5 times
    backoff: { type: 'exponential', delay: 30_000 }, // 30s, 60s, 120s, 240s, 480s
    removeOnComplete: { count: 1000 },    // Keep last 1000 for audit
    removeOnFail: false,                  // Keep failed jobs for inspection
  });
}

// Worker processes jobs
const worker = new Worker<DsaJobPayload>(DSA_QUEUE, async (job) => {
  try {
    await submitStatementToEU(job.data.statementId);
  } catch (error) {
    await handleSubmissionError(job.data.statementId, error);
  }
}, {
  connection: redisClient,
  concurrency: 2, // Process 2 jobs in parallel
});

worker.on('completed', (job) => {
  console.log('[DSA] Submitted:', job.data.referenceNumber);
});

worker.on('failed', (job, error) => {
  console.error('[DSA] Failed:', job?.data.referenceNumber, error.message);
});
```

### Without a Queue

If you don't have Redis/BullMQ, use dsa-toolkit's built-in `InMemoryQueue`:

```typescript
import { TransparencyDatabaseClient, InMemoryQueue } from 'dsa-toolkit';

const client = new TransparencyDatabaseClient({ token: process.env.DSA_EU_API_TOKEN! });
const queue = new InMemoryQueue();
client.setQueue(queue);

// submitOrQueue automatically queues on transient errors
await client.submitOrQueue(sor);

// Periodically flush the queue
setInterval(async () => {
  const { submitted, failed } = await client.flushQueue();
  if (submitted > 0) console.log('[DSA] Flushed ' + submitted + ' statements');
}, 5 * 60 * 1000);
```

> **Warning**: `InMemoryQueue` loses its contents on process restart. For production, use a persistent queue like BullMQ.

---

## 9. Complaint Handling (Art. 20)

DSA Art. 20 requires that users can contest moderation decisions. Key requirements:

- **6-month window** — users have 6 months from the decision date to complain
- **Different reviewer** — the complaint must be reviewed by someone who wasn't involved in the original decision
- **Timely response** — you must respond "without undue delay"
- **Reasoned outcome** — the outcome must include a reason

### Database model

See the `Complaint` model in [`examples/prisma-schema.prisma`](../examples/prisma-schema.prisma).

### Submission validation

```typescript
import { isAppealWindowOpen } from 'dsa-toolkit';

async function createComplaint(userId: string, statementId: string, complaintText: string) {
  const statement = await db.statementOfReasons.findById(statementId);

  // Verify user is the recipient
  if (statement.recipientId !== userId) {
    throw new Error('You can only contest your own decisions');
  }

  // Check 6-month window
  if (!isAppealWindowOpen(statement.createdAt)) {
    throw new Error('The 6-month complaint window has expired');
  }

  // Prevent duplicate complaints on same statement
  const existing = await db.complaint.findFirst({
    where: { userId, statementId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
  });
  if (existing) {
    throw new Error('You already have a pending complaint for this decision');
  }

  return db.complaint.create({
    data: {
      userId,
      statementId,
      originalDecision: statement.decisionType,
      complaintText,
      status: 'PENDING',
      originalDecisionBy: statement.decidedBy, // Track for different-reviewer enforcement
    },
  });
}
```

### Different-reviewer enforcement

```typescript
async function resolveComplaint(
  complaintId: string,
  reviewerId: string,
  outcome: 'UPHELD' | 'PARTIALLY_UPHELD' | 'REJECTED',
  reason: string,
) {
  const complaint = await db.complaint.findById(complaintId);

  // DSA Art. 20(4): reviewer must differ from original decision maker
  if (complaint.originalDecisionBy === reviewerId) {
    throw new Error('Complaint must be reviewed by a different staff member (DSA Art. 20(4))');
  }

  await db.complaint.update(complaintId, {
    status: 'RESOLVED',
    assignedTo: reviewerId,
    outcome,
    outcomeReason: reason,
    reviewedAt: new Date(),
  });

  // Notify user of outcome
  await notifyUser(complaint.userId, {
    type: 'COMPLAINT_RESOLVED',
    outcome,
    reason,
  });
}
```

---

## 10. Trusted Flaggers (Art. 22)

Trusted flaggers are entities recognized for expertise in detecting illegal content. Their reports get priority processing.

### Tracking accuracy

```typescript
import { evaluateFlaggerStatus, calculatePriority } from 'dsa-toolkit';

// After resolving a report, update the flagger's stats
async function updateFlaggerStats(reporterId: string) {
  const stats = await db.report.aggregate({
    where: { reporterId },
    _count: { id: true },
    // Count reports where action was taken
  });

  const totalReports = stats._count.id;
  const actionTaken = await db.report.count({
    where: { reporterId, status: 'ACTION_TAKEN' },
  });
  const noAction = await db.report.count({
    where: { reporterId, status: 'NO_ACTION' },
  });

  // Use dsa-toolkit to evaluate eligibility
  const evaluation = evaluateFlaggerStatus({
    totalReports,
    actionTakenCount: actionTaken,
    noActionCount: noAction,
    pendingCount: totalReports - actionTaken - noAction,
  });

  // Update user record
  await db.user.update(reporterId, {
    trustedFlaggerReports: totalReports,
    trustedFlaggerAccuracy: evaluation.accuracy ? Math.round(evaluation.accuracy * 100) : 0,
  });

  // Auto-revoke if accuracy drops below threshold
  if (!evaluation.eligible && (await db.user.findById(reporterId)).isTrustedFlagger) {
    console.warn('[DSA] Trusted flagger ' + reporterId + ' dropped below accuracy threshold: ' + evaluation.reason);
    // Consider revoking status
  }
}
```

### Priority processing

```typescript
// When processing incoming reports, boost priority for trusted flaggers
async function processReport(report: Report) {
  const reporter = await db.user.findById(report.reporterId);
  const priority = calculatePriority(report.basePriority, reporter.isTrustedFlagger);
  // priority is 2x for trusted flaggers (configurable)

  await db.report.update(report.id, {
    priority,
    trustedFlaggerReport: reporter.isTrustedFlagger,
  });
}
```

---

## 11. Transparency Reports (Art. 15/24)

DSA requires annual transparency reports. dsa-toolkit generates them — you provide the data.

### Implementing the data provider

The `TransparencyDataProvider` interface defines 9 methods you need to implement. Each one queries your database:

```typescript
import { createReportGenerator, toCSV, toJSON, toMarkdown } from 'dsa-toolkit';
import type { TransparencyDataProvider, ReportingPeriod } from 'dsa-toolkit/reports';

const provider: TransparencyDataProvider = {
  async getAuthorityOrders(period) {
    // SELECT member_state, category, COUNT(*) FROM authority_orders
    // WHERE created_at BETWEEN period.start AND period.end
    // GROUP BY member_state, category
    const orders = await db.authorityOrder.groupBy({ ... });
    return {
      entries: orders.map(o => ({
        memberState: o.memberState,
        category: o.category,
        ordersReceived: o._count,
        ordersComplied: o.compliedCount,
        medianResponseHours: o.medianHours,
      })),
      totalReceived: orders.reduce((sum, o) => sum + o._count, 0),
      totalComplied: orders.reduce((sum, o) => sum + o.compliedCount, 0),
    };
  },

  async getNoticeStats(period) {
    // Aggregate Art. 16 notice data by category
    const reports = await db.report.groupBy({
      by: ['category'],
      where: { createdAt: { gte: period.start, lte: period.end } },
      _count: true,
    });
    return {
      entries: reports.map(r => ({
        category: r.category,
        totalReceived: r._count,
        actionTaken: r.actionCount,
        medianProcessingHours: r.medianHours,
      })),
      totalReceived: reports.reduce((sum, r) => sum + r._count, 0),
      totalActionTaken: reports.reduce((sum, r) => sum + r.actionCount, 0),
    };
  },

  // ... implement remaining methods (see docs/API.md for full interface)
  async getOwnInitiativeStats(period) { /* ... */ },
  async getTosViolationStats(period) { /* ... */ },
  async getComplaintStats(period) { /* ... */ },
  async getAutomationStats(period) { /* ... */ },
  async getHumanResourceStats(period) { /* ... */ },
  async getAmarStats(period) { /* ... */ },
  async getQualitativeData(period) { /* ... */ },
  async getProcessingTimeStats(period) { /* ... */ },
};
```

### Generating reports

```typescript
const generator = createReportGenerator({
  platformName: 'MyPlatform',
  legalEntity: 'MyPlatform GmbH',
  platformUrl: 'https://myplatform.example.com',
  tierConfig: { tier: 'PLATFORM', isSmallEnterprise: false },
  // Use 'VLOP' if you have 45M+ monthly active users in the EU
  contactEmail: 'dsa@myplatform.example.com',
});

const period: ReportingPeriod = {
  start: new Date('2025-01-01'),
  end: new Date('2025-12-31'),
  year: 2025,
};

const report = await generator.generate(provider, period);

// Export in multiple formats
const json = toJSON(report);     // Machine-readable
const markdown = toMarkdown(report); // Human-readable
const csvParts = toCSV(report);  // Spreadsheet-friendly (one CSV per section)
```

---

## What's Next?

Once you have all of this integrated:

1. **Test with `DSA_EU_SUBMISSIONS_ENABLED=false`** — verify statements are created and queued correctly without hitting the EU API
2. **Test against the mock server** — use `dsa-toolkit/testing` to run a local mock EU API
3. **Register at the EU Transparency Database** — get your production API token
4. **Flip `DSA_EU_SUBMISSIONS_ENABLED=true`** — start submitting for real

For the complete API reference, see [API.md](API.md). For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md). For error handling patterns, see [ERROR-HANDLING.md](ERROR-HANDLING.md).
