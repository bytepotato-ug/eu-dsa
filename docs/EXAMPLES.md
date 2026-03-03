# Examples

Real-world integration patterns for eu-dsa.

## Express Integration

```ts
import express from 'express';
import {
  TransparencyDatabaseClient,
  SoRBuilder,
  createPlatformMapper,
  createDsaEventEmitter,
  Category,
  CategorySpecification,
  randomPuid,
  sanitizeForSubmission,
} from 'eu-dsa';

const app = express();
app.use(express.json());

// Configure the API client
const client = new TransparencyDatabaseClient({
  token: process.env.EU_API_TOKEN!,
  retry: { maxAttempts: 3, baseDelayMs: 1000 },
  interceptors: {
    request: [(ctx) => {
      console.log(`[DSA] ${ctx.method} ${ctx.url}`);
      return ctx;
    }],
  },
});

// Set up platform category mapping
const mapCategory = createPlatformMapper({
  platformName: 'myapp',
  categories: {
    HATE_SPEECH: {
      euCategory: Category.ILLEGAL_OR_HARMFUL_SPEECH,
      euSpecifications: [CategorySpecification.HATE_SPEECH],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: '§130 StGB',
    },
    SPAM: {
      euCategory: Category.SPAM,
      defaultGround: 'INCOMPATIBLE_CONTENT',
      defaultExplanation: 'Violates platform Terms of Service on spam.',
    },
    COPYRIGHT: {
      euCategory: Category.INTELLECTUAL_PROPERTY_INFRINGEMENTS,
      euSpecifications: [CategorySpecification.COPYRIGHT_INFRINGEMENT],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: 'Directive 2001/29/EC',
    },
  },
  defaultContentTypes: ['CONTENT_TYPE_TEXT'],
  defaultTerritorialScope: ['DE'],
});

// Set up event listener for monitoring
const events = createDsaEventEmitter();
events.on('sor.submitted', ({ response }) => {
  console.log(`[DSA] Statement submitted: ${response.uuid}`);
});
events.on('api.rate_limited', ({ retryAfterMs }) => {
  console.warn(`[DSA] Rate limited, retry after ${retryAfterMs}ms`);
});

// Endpoint: submit a moderation decision
app.post('/api/moderation/decision', async (req, res) => {
  const { contentId, category, facts, moderatorId } = req.body;

  try {
    // Build the Statement of Reasons
    const builder = new SoRBuilder();
    mapCategory(builder, category);

    const sor = builder
      .puid(randomPuid('myapp'))
      .facts(sanitizeForSubmission(facts))
      .dates({
        content: new Date().toISOString().split('T')[0],
        application: new Date().toISOString().split('T')[0],
      })
      .source('OWN_INITIATIVE')
      .automatedDetection(false)
      .automatedDecision('NOT_AUTOMATED')
      .build();

    // Submit to EU Transparency Database
    const response = await client.submitStatement(sor);

    events.emit('sor.submitted', { submission: sor, response });

    res.json({
      success: true,
      uuid: response.uuid,
      permalink: response.permalink,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit statement' });
  }
});

app.listen(3000);
```

## Background Worker (Queue Flush)

```ts
import {
  TransparencyDatabaseClient,
  InMemoryQueue,
} from 'eu-dsa';

const client = new TransparencyDatabaseClient({
  token: process.env.EU_API_TOKEN!,
});

const queue = new InMemoryQueue({ maxSize: 50_000, maxRetries: 5 });
client.setQueue(queue);

// In your moderation handler, use submitOrQueue for resilience
async function submitDecision(sor) {
  const result = await client.submitOrQueue(sor);
  if ('status' in result && result.status === 'pending') {
    console.log(`Queued for retry: ${result.id}`);
  }
}

// Periodic flush worker — runs every 5 minutes
setInterval(async () => {
  const size = await queue.size();
  if (size === 0) return;

  console.log(`Flushing ${size} queued statements...`);
  const { submitted, failed } = await client.flushQueue();
  console.log(`Flush complete: ${submitted} submitted, ${failed} failed`);
}, 5 * 60 * 1000);
```

## Batch Processing

```ts
import {
  TransparencyDatabaseClient,
  SoRBuilder,
  randomPuid,
  sanitizeForSubmission,
} from 'eu-dsa';

const client = new TransparencyDatabaseClient({
  token: process.env.EU_API_TOKEN!,
  retry: { maxAttempts: 3 },
});

// Process moderation decisions from your database
async function processBatch(decisions: ModerationDecision[]) {
  const submissions = decisions.map(decision => {
    return new SoRBuilder()
      .contentRemoved()
      .illegalContent(decision.legalGround, decision.explanation)
      .contentType('TEXT')
      .category('ILLEGAL_OR_HARMFUL_SPEECH')
      .dates({
        content: decision.contentDate,
        application: decision.decisionDate,
      })
      .facts(sanitizeForSubmission(decision.facts))
      .source('ARTICLE_16')
      .automatedDetection(decision.usedAI)
      .automatedDecision(decision.usedAI ? 'PARTIALLY_AUTOMATED' : 'NOT_AUTOMATED')
      .puid(randomPuid('myapp'))
      .territorialScope(['DE'])
      .build();
  });

  // submitStatements auto-chunks into 100-item batches
  const result = await client.submitStatements(submissions);
  console.log(`Submitted ${result.statements.length} statements`);
  return result;
}
```

## Full Notice-and-Action Flow

```ts
import {
  createNotice,
  NoticeStateMachine,
  NoticeState,
  getNoticeDeadlines,
  getDeadlineAlerts,
  calculatePriority,
  createDsaEventEmitter,
  createInMemoryStorage,
} from 'eu-dsa';

const stateMachine = new NoticeStateMachine({
  onTransition: async (notice, from, to) => {
    events.emit('notice.state_changed', {
      noticeId: notice.id,
      from,
      to,
    });
  },
});

const events = createDsaEventEmitter();
const storage = createInMemoryStorage();

// 1. Receive a notice
async function receiveNotice(report) {
  const priority = calculatePriority(50, report.isTrustedFlagger);

  const notice = createNotice({
    source: {
      type: 'SOURCE_ARTICLE_16',
      reporterId: report.reporterId,
      isTrustedFlagger: report.isTrustedFlagger,
    },
    content: {
      contentId: report.contentId,
      contentType: 'text',
    },
    classification: {
      platformCategory: report.category,
    },
    priority,
  });

  await storage.notices.save(notice);
  events.emit('notice.received', { noticeId: notice.id, category: report.category });

  // 2. Acknowledge
  const acknowledged = await stateMachine.transition(notice, NoticeState.ACKNOWLEDGED);
  await storage.notices.update(acknowledged.id, acknowledged);

  // 3. Check deadlines
  const deadlines = getNoticeDeadlines(acknowledged, {
    isNetzDGApplicable: true,
    isManifestlyIllegal: false,
  });
  console.log('Deadlines:', deadlines.map(d => `${d.type}: ${d.dueAt.toISOString()}`));

  return acknowledged;
}

// 4. Assess and decide
async function decideNotice(noticeId, decision) {
  let notice = await storage.notices.findById(noticeId);
  if (!notice) throw new Error('Notice not found');

  notice = await stateMachine.transition(notice, NoticeState.ASSESSING);
  notice = await stateMachine.transition(notice, NoticeState.DECIDED_ACTION_TAKEN);
  notice = { ...notice, decision };

  await storage.notices.update(notice.id, notice);
  events.emit('notice.decided', { noticeId: notice.id, decision: decision.action });

  // 5. Check for deadline alerts
  const alerts = getDeadlineAlerts(notice, { isNetzDGApplicable: true });
  if (alerts.length > 0) {
    for (const alert of alerts) {
      events.emit('notice.deadline_warning', {
        noticeId: notice.id,
        deadlineType: alert.type,
        remainingMs: alert.remainingMs,
      });
    }
  }

  return notice;
}
```

## Transparency Report Generation

```ts
import {
  createReportGenerator,
  toCSV,
  toJSON,
  toMarkdown,
} from 'eu-dsa';
import type { TransparencyDataProvider, ReportingPeriod } from 'eu-dsa/reports';
import fs from 'node:fs';

// Implement the data provider backed by your database
const provider: TransparencyDataProvider = {
  async getAuthorityOrders(period) {
    // Query: SELECT member_state, category, COUNT(*) ...
    // FROM authority_orders WHERE date BETWEEN period.start AND period.end
    return {
      entries: [
        { memberState: 'DE', category: 'Illegal Speech', ordersReceived: 12, ordersComplied: 11, medianResponseHours: 8 },
      ],
      totalReceived: 12,
      totalComplied: 11,
    };
  },
  async getNoticeStats(period) {
    // Query your notices table...
    return { entries: [], totalReceived: 0, totalActionTaken: 0 };
  },
  async getOwnInitiativeStats(period) {
    return { entries: [], totalActioned: 0 };
  },
  async getTosViolationStats(period) {
    return { entries: [], totalActioned: 0, trustedFlaggerTotal: 0 };
  },
  async getComplaintStats(period) {
    return {
      complaintsByBasis: { illegalContent: 0, tosViolation: 0 },
      totalComplaints: 0, decisionsReversed: 0, medianResolutionDays: 0,
      disputesSubmitted: 0, disputeOutcomes: { inFavourComplainant: 0, inFavourProvider: 0, settled: 0 },
      suspensionsImposed: 0, suspensionsByCategory: {},
    };
  },
  async getAutomationStats(period) {
    return {
      tools: [{
        toolName: 'Content Classifier v2',
        purpose: 'detection',
        description: 'ML-based content classification',
        categories: ['Hate Speech', 'Spam'],
        safeguards: 'Human review required before action',
      }],
    };
  },
  async getHumanResourceStats(period) {
    return {
      entries: [
        { language: 'DE', moderatorCount: 5, qualifications: 'DSA-certified' },
        { language: 'EN', moderatorCount: 3, qualifications: 'DSA-certified' },
      ],
      totalModerators: 8,
    };
  },
  async getAmarStats(period) {
    return {
      entries: [
        { toolName: 'Content Classifier v2', language: 'DE', accuracyIndicator: 0.92, errorRate: 0.08 },
      ],
    };
  },
  async getQualitativeData(period) {
    return {
      methodology: 'Human-in-the-loop moderation with ML pre-screening.',
      challenges: 'Cross-language content remains difficult.',
      cooperationWithAuthorities: 'Monthly reports to BNetzA.',
    };
  },
  async getProcessingTimeStats(period) {
    return { medianNoticeHandlingHours: 6, medianOrderResponseHours: 10, medianComplaintResolutionDays: 12 };
  },
};

// Generate the report
const generator = createReportGenerator({
  platformName: 'MyPlatform',
  legalEntity: 'MyPlatform GmbH',
  platformUrl: 'https://myplatform.example.com',
  tierConfig: { tier: 'VLOP', isSmallEnterprise: false },
  contactEmail: 'dsa@myplatform.example.com',
});

const period: ReportingPeriod = {
  start: new Date('2025-01-01'),
  end: new Date('2025-12-31'),
  year: 2025,
};

const report = await generator.generate(provider, period);

// Export in all formats
fs.writeFileSync('report.json', toJSON(report));
fs.writeFileSync('report.md', toMarkdown(report));

const csvParts = toCSV(report);
for (const [key, csv] of Object.entries(csvParts)) {
  if (csv) fs.writeFileSync(`report_${key}.csv`, csv);
}
```
