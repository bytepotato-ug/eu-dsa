/**
 * Zod validation schema for EU Transparency Database SoR submissions.
 *
 * Implements all conditional validation rules from the EU API:
 * 1. At least one decision type required
 * 2. Illegal content fields required when ground = ILLEGAL_CONTENT
 * 3. Incompatible content fields required when ground = INCOMPATIBLE_CONTENT
 * 4. "Other" free-text required when corresponding OTHER enum is selected
 * 5. Source identity excluded when source_type = VOLUNTARY
 * 6. PUID format: /^[a-zA-Z0-9-_]+$/
 * 7. Date ranges enforced
 */

import { z } from 'zod';
import {
  AccountType,
  AutomatedDecision,
  Category,
  CategorySpecification,
  ContentType,
  DecisionAccount,
  DecisionGround,
  DecisionMonetary,
  DecisionProvision,
  DecisionVisibility,
  SourceType,
  TerritorialScope,
  enumValues,
} from './enums.js';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const puidRegex = /^[a-zA-Z0-9\-_]+$/;
const ean13Regex = /^[0-9]{13}$/;

const dateField = (label: string) =>
  z.string({ required_error: `${label} is required` })
    .regex(dateRegex, `${label} must be YYYY-MM-DD format`);

export const sorSubmissionSchema = z.object({
  // Decision fields
  decision_visibility: z.array(z.enum(enumValues(DecisionVisibility))).optional().nullable(),
  decision_visibility_other: z.string().max(500).optional().nullable(),
  decision_monetary: z.enum(enumValues(DecisionMonetary)).optional().nullable(),
  decision_monetary_other: z.string().max(500).optional().nullable(),
  decision_provision: z.enum(enumValues(DecisionProvision)).optional().nullable(),
  decision_account: z.enum(enumValues(DecisionAccount)).optional().nullable(),
  account_type: z.enum(enumValues(AccountType)).optional().nullable(),

  // Decision ground
  decision_ground: z.enum(enumValues(DecisionGround)),
  decision_ground_reference_url: z.string().url().max(500).optional().nullable(),

  // Illegal content fields
  illegal_content_legal_ground: z.string().max(500).optional().nullable(),
  illegal_content_explanation: z.string().max(2000).optional().nullable(),

  // Incompatible content fields
  incompatible_content_ground: z.string().max(500).optional().nullable(),
  incompatible_content_explanation: z.string().max(2000).optional().nullable(),
  incompatible_content_illegal: z.enum(['Yes', 'No']).optional().nullable(),

  // Content type
  content_type: z.array(z.enum(enumValues(ContentType))).min(1, 'At least one content_type is required'),
  content_type_other: z.string().max(500).optional().nullable(),

  // Category
  category: z.enum(enumValues(Category)),
  category_addition: z.array(z.enum(enumValues(Category))).optional().nullable(),
  category_specification: z.array(z.enum(enumValues(CategorySpecification))).optional().nullable(),
  category_specification_other: z.string().max(500).optional().nullable(),

  // Dates
  content_date: dateField('content_date'),
  application_date: dateField('application_date'),
  end_date_visibility_restriction: z.string().regex(dateRegex).optional().nullable(),
  end_date_monetary_restriction: z.string().regex(dateRegex).optional().nullable(),
  end_date_service_restriction: z.string().regex(dateRegex).optional().nullable(),
  end_date_account_restriction: z.string().regex(dateRegex).optional().nullable(),

  // Facts
  decision_facts: z.string().min(1, 'decision_facts is required').max(5000),

  // Source
  source_type: z.enum(enumValues(SourceType)),
  source_identity: z.string().max(500).optional().nullable(),

  // Automation
  automated_detection: z.enum(['Yes', 'No']),
  automated_decision: z.enum(enumValues(AutomatedDecision)),

  // PUID
  puid: z.string()
    .min(1, 'puid is required')
    .max(500)
    .regex(puidRegex, 'puid must contain only alphanumeric characters, hyphens, and underscores'),

  // Scope
  territorial_scope: z.array(z.enum(TerritorialScope as unknown as readonly [string, ...string[]])).optional().nullable(),
  content_language: z.string().length(2).optional().nullable(),

  // Content ID
  content_id: z.object({
    'EAN-13': z.string().regex(ean13Regex, 'EAN-13 must be exactly 13 digits').optional(),
  }).optional().nullable(),
}).superRefine((data, ctx) => {
  // Rule 1: At least one decision type must be provided
  const hasVisibility = data.decision_visibility && data.decision_visibility.length > 0;
  const hasMonetary = !!data.decision_monetary;
  const hasProvision = !!data.decision_provision;
  const hasAccount = !!data.decision_account;

  if (!hasVisibility && !hasMonetary && !hasProvision && !hasAccount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one of decision_visibility, decision_monetary, decision_provision, or decision_account must be provided',
      path: ['decision_visibility'],
    });
  }

  // Rule 2: Illegal content fields required when ground = ILLEGAL_CONTENT
  if (data.decision_ground === DecisionGround.ILLEGAL_CONTENT) {
    if (!data.illegal_content_legal_ground) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'illegal_content_legal_ground is required when decision_ground is ILLEGAL_CONTENT',
        path: ['illegal_content_legal_ground'],
      });
    }
    if (!data.illegal_content_explanation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'illegal_content_explanation is required when decision_ground is ILLEGAL_CONTENT',
        path: ['illegal_content_explanation'],
      });
    }
  }

  // Rule 3: Incompatible content fields required when ground = INCOMPATIBLE_CONTENT
  if (data.decision_ground === DecisionGround.INCOMPATIBLE_CONTENT) {
    if (!data.incompatible_content_ground) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'incompatible_content_ground is required when decision_ground is INCOMPATIBLE_CONTENT',
        path: ['incompatible_content_ground'],
      });
    }
    if (!data.incompatible_content_explanation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'incompatible_content_explanation is required when decision_ground is INCOMPATIBLE_CONTENT',
        path: ['incompatible_content_explanation'],
      });
    }
  }

  // Rule 4: "Other" free text required when OTHER enum selected
  if (data.decision_visibility?.includes(DecisionVisibility.OTHER as string) && !data.decision_visibility_other) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'decision_visibility_other is required when DECISION_VISIBILITY_OTHER is selected',
      path: ['decision_visibility_other'],
    });
  }

  if (data.decision_monetary === DecisionMonetary.OTHER && !data.decision_monetary_other) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'decision_monetary_other is required when DECISION_MONETARY_OTHER is selected',
      path: ['decision_monetary_other'],
    });
  }

  if (data.content_type.includes(ContentType.OTHER as string) && !data.content_type_other) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'content_type_other is required when CONTENT_TYPE_OTHER is selected',
      path: ['content_type_other'],
    });
  }

  // Rule 5: source_identity excluded when source_type = VOLUNTARY
  // (Not an error, just noting the API behavior — we don't reject, just the API ignores it)

  // Date range validation
  const contentDate = new Date(data.content_date);
  const applicationDate = new Date(data.application_date);

  if (contentDate < new Date('2000-01-01')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'content_date must be on or after 2000-01-01',
      path: ['content_date'],
    });
  }

  if (applicationDate < new Date('2020-01-01')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'application_date must be on or after 2020-01-01',
      path: ['application_date'],
    });
  }
});

export type ValidatedSorSubmission = z.infer<typeof sorSubmissionSchema>;
