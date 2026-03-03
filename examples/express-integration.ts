// =============================================================================
// DSA Compliance — Express Integration Reference
// =============================================================================
//
// This file shows a complete Express integration with eu-dsa.
// It is NOT a runnable app — it's a well-commented reference showing the
// patterns you need. Adapt to your database, auth, and infrastructure.
//
// What's covered:
//   1. Client + mapper initialization
//   2. POST /api/moderation/action — Content moderation with SoR creation
//   3. POST /api/complaints — User contests a decision (Art. 20)
//   4. GET  /api/users/:id/statements — User views their SoRs (Art. 17)
//   5. GET  /admin/dsa/stats — Admin monitoring endpoint
//
// Prerequisites:
//   npm install eu-dsa express
//   Database schema from examples/prisma-schema.prisma
// =============================================================================

import express from 'express';
import {
  TransparencyDatabaseClient,
  SoRBuilder,
  createPlatformMapper,
  createDsaEventEmitter,
  deterministicPuid,
  sanitizeForSubmission,
  isAppealWindowOpen,
  calculatePriority,
  Category,
  CategorySpecification,
  ContentType,
  DecisionVisibility,
  AutomatedDecision,
  SourceType,
  DsaPuidConflictError,
  DsaAuthError,
  DsaValidationError,
  DsaRateLimitError,
} from 'eu-dsa';

const app = express();
app.use(express.json());

// =============================================================================
// 1. INITIALIZATION
// =============================================================================

// API client (singleton)
const client = new TransparencyDatabaseClient({
  token: process.env.DSA_EU_API_TOKEN!,
  timeoutMs: 30_000,
  retry: { maxAttempts: 1 }, // Let your job queue handle retries
  userAgent: 'myplatform/1.0 eu-dsa/1.0.0',
});

// Category mapper — maps your platform's categories to EU taxonomy
const applyCategory = createPlatformMapper({
  platformName: 'myplatform',
  defaultTerritorialScope: ['DE'],
  categories: {
    HATE_SPEECH: {
      euCategory: Category.ILLEGAL_OR_HARMFUL_SPEECH,
      euSpecifications: [CategorySpecification.HATE_SPEECH],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: '§130 StGB (DE)',
    },
    TERRORISM: {
      euCategory: Category.RISK_FOR_PUBLIC_SECURITY,
      euSpecifications: [CategorySpecification.TERRORIST_CONTENT],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: 'EU Regulation 2021/784',
    },
    COPYRIGHT: {
      euCategory: Category.INTELLECTUAL_PROPERTY_INFRINGEMENTS,
      euSpecifications: [CategorySpecification.COPYRIGHT_INFRINGEMENT],
      defaultGround: 'ILLEGAL_CONTENT',
      legalGround: 'Directive 2001/29/EC',
    },
    HARASSMENT: {
      euCategory: Category.CYBER_VIOLENCE,
      defaultGround: 'INCOMPATIBLE_CONTENT',
      legalGround: 'Community Guidelines',
    },
    SPAM: {
      euCategory: Category.SCAMS_AND_FRAUD,
      defaultGround: 'INCOMPATIBLE_CONTENT',
      legalGround: 'Community Guidelines',
    },
    OTHER: {
      euCategory: Category.OTHER_VIOLATION_TC,
      defaultGround: 'INCOMPATIBLE_CONTENT',
      legalGround: 'Community Guidelines',
    },
  },
  defaultContentTypes: [ContentType.TEXT],
});

// Event system for monitoring
const events = createDsaEventEmitter();
events.on('sor.submitted', ({ response }) => {
  console.log('[DSA] Statement submitted:', response.uuid);
});
events.on('sor.submission_failed', ({ error }) => {
  console.error('[DSA] Submission failed:', error.message);
});

// Standard redress text (DSA Art. 17(3)(e))
const REDRESS_INFO = `You have the right to contest this decision:
1. Internal complaint within 6 months (DSA Art. 20)
2. Out-of-court dispute resolution (DSA Art. 21)
3. Judicial remedies through courts`;

// =============================================================================
// 2. POST /api/moderation/action — Admin takes moderation action
// =============================================================================
// When an admin removes/hides content, this endpoint:
//   a) Creates a Statement of Reasons in the database
//   b) Submits it to the EU Transparency Database
//   c) Notifies the affected user

app.post('/api/moderation/action', async (req, res) => {
  const { postId, category, decisionType, reason, legalRef } = req.body;
  // decisionType: 'CONTENT_REMOVED' | 'CONTENT_HIDDEN' | etc.

  try {
    // --- 1. Create reference number ---
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const referenceNumber = 'SOR-' + year + '-' + random;

    // --- 2. Save Statement of Reasons to your database ---
    // Adapt this to your ORM (Prisma, Drizzle, Knex, etc.)
    const statement = await db.statementOfReasons.create({
      recipientId: postAuthorId,
      recipientType: 'CONTENT_AUTHOR',
      decisionType,
      contentId: postId,
      factsCircumstances: 'Content reviewed and found to violate policies regarding: ' + category,
      legalGround: 'Community Guidelines - ' + category + (legalRef ? '; ' + legalRef : ''),
      groundExplanation: reason,
      redressInfo: REDRESS_INFO,
      referenceNumber,
      automatedInfo: null,
    });

    // --- 3. Build and submit to EU Transparency Database ---
    if (process.env.DSA_EU_SUBMISSIONS_ENABLED === 'true') {
      const builder = new SoRBuilder();
      applyCategory(builder, category);

      const puid = deterministicPuid({
        platform: 'myplatform',
        actionType: decisionType.toLowerCase().replace(/_/g, '-'),
        referenceId: referenceNumber,
      });

      const sor = builder
        .puid(puid)
        .visibility(DecisionVisibility.CONTENT_REMOVED)
        .facts(sanitizeForSubmission(statement.factsCircumstances, {
          stripIps: true,
          stripEmailAddresses: true,
          stripUserMentions: true,
        }))
        .dates({
          content: new Date().toISOString().slice(0, 10),
          application: new Date().toISOString().slice(0, 10),
        })
        .source(SourceType.ARTICLE_16)
        .automatedDetection(false)
        .automatedDecision(AutomatedDecision.NOT_AUTOMATED)
        .build();

      // In production, enqueue this instead of awaiting inline:
      //   await dsaQueue.add('submit', { statementId, puid, sor });
      const result = await client.submitStatement(sor);

      await db.statementOfReasons.update(statement.id, {
        euSubmittedAt: new Date(),
        euPuid: puid,
        euSubmissionUuid: result.uuid,
      });
    }

    res.json({ success: true, referenceNumber });
  } catch (error) {
    // Handle eu-dsa errors specifically
    if (error instanceof DsaPuidConflictError) {
      // Already submitted — idempotent, treat as success
      res.json({ success: true, note: 'Already submitted' });
    } else if (error instanceof DsaValidationError) {
      res.status(422).json({ error: 'Invalid SoR data', fields: error.fieldErrors });
    } else if (error instanceof DsaAuthError) {
      console.error('[DSA] Auth failed — check DSA_EU_API_TOKEN');
      // Still save statement locally, just skip EU submission
      res.json({ success: true, note: 'EU submission deferred (auth error)' });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// =============================================================================
// 3. POST /api/complaints — User contests a moderation decision
// =============================================================================
// DSA Art. 20 requirements:
//   - 6-month filing window
//   - Different reviewer from original decision maker
//   - Timely response with reasoning

app.post('/api/complaints', async (req, res) => {
  const userId = req.user.id; // From your auth middleware
  const { statementId, complaintText } = req.body;

  try {
    // Look up the statement being contested
    const statement = await db.statementOfReasons.findById(statementId);
    if (!statement || statement.recipientId !== userId) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    // Check 6-month appeal window (DSA Art. 20(1))
    if (!isAppealWindowOpen(statement.createdAt)) {
      return res.status(400).json({ error: 'The 6-month complaint window has expired' });
    }

    // Prevent duplicate pending complaints
    const existing = await db.complaint.findFirst({
      where: { userId, statementId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already have a pending complaint for this decision' });
    }

    // Create complaint
    const complaint = await db.complaint.create({
      userId,
      statementId,
      originalDecision: statement.decisionType,
      complaintText,
      status: 'PENDING',
      // Track who made the original decision so we can enforce different-reviewer
      originalDecisionBy: statement.decidedByAdminId,
    });

    res.status(201).json({
      id: complaint.id,
      message: 'Your complaint has been received and will be reviewed by a staff member ' +
               'who was not involved in the original decision.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

// =============================================================================
// 4. GET /api/users/:id/statements — User views their Statements of Reasons
// =============================================================================
// DSA Art. 17 — users must be able to access their SoRs

app.get('/api/users/:id/statements', async (req, res) => {
  const userId = req.user.id; // Verify user can only see their own
  if (req.params.id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = parseInt(req.query.offset as string) || 0;

  const [statements, total, unreadCount] = await Promise.all([
    db.statementOfReasons.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.statementOfReasons.count({ where: { recipientId: userId } }),
    db.statementOfReasons.count({ where: { recipientId: userId, readAt: null } }),
  ]);

  res.json({
    statements,
    pagination: { total, limit, offset, hasMore: offset + statements.length < total },
    unreadCount,
  });
});

// =============================================================================
// 5. GET /admin/dsa/stats — Admin DSA monitoring dashboard
// =============================================================================

app.get('/admin/dsa/stats', async (req, res) => {
  // Requires admin auth middleware (not shown)

  const [
    totalStatements,
    pendingSubmissions,
    failedSubmissions,
    pendingComplaints,
  ] = await Promise.all([
    db.statementOfReasons.count(),
    db.statementOfReasons.count({
      where: { euSubmittedAt: null, decisionType: { not: 'CONTENT_RESTORED' } },
    }),
    db.statementOfReasons.count({
      where: { euSubmissionError: { not: null }, euSubmittedAt: null },
    }),
    db.complaint.count({ where: { status: 'PENDING' } }),
  ]);

  res.json({
    euSubmissions: {
      enabled: process.env.DSA_EU_SUBMISSIONS_ENABLED === 'true',
      total: totalStatements,
      pending: pendingSubmissions,
      failed: failedSubmissions,
    },
    complaints: {
      pending: pendingComplaints,
    },
  });
});

// =============================================================================
// HELPERS (referenced in routes above)
// =============================================================================

// Placeholder for your database client — replace with Prisma, Drizzle, etc.
declare const db: any;
declare const postAuthorId: string;

app.listen(3000, () => {
  console.log('Server running on :3000');
  console.log('DSA EU submissions:', process.env.DSA_EU_SUBMISSIONS_ENABLED === 'true' ? 'ENABLED' : 'DISABLED');
});
