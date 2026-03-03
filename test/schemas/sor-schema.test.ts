import { describe, it, expect } from 'vitest';
import { sorSubmissionSchema } from '../../src/schemas/sor-schema.js';

function validPayload(overrides = {}) {
  return {
    decision_visibility: ['DECISION_VISIBILITY_CONTENT_REMOVED'],
    decision_ground: 'DECISION_GROUND_ILLEGAL_CONTENT',
    illegal_content_legal_ground: '§130 StGB',
    illegal_content_explanation: 'Incitement to hatred',
    content_type: ['CONTENT_TYPE_TEXT'],
    category: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
    content_date: '2024-06-15',
    application_date: '2024-06-16',
    decision_facts: 'User posted hate speech targeting an ethnic group.',
    source_type: 'SOURCE_ARTICLE_16',
    automated_detection: 'No',
    automated_decision: 'AUTOMATED_DECISION_NOT_AUTOMATED',
    puid: 'myapp-mod-12345',
    ...overrides,
  };
}

describe('sorSubmissionSchema', () => {
  describe('valid payloads', () => {
    it('accepts a minimal valid SoR with illegal content ground', () => {
      const result = sorSubmissionSchema.safeParse(validPayload());
      expect(result.success).toBe(true);
    });

    it('accepts incompatible content ground with required fields', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_ground: 'DECISION_GROUND_INCOMPATIBLE_CONTENT',
        illegal_content_legal_ground: undefined,
        illegal_content_explanation: undefined,
        incompatible_content_ground: 'Section 3.2 of Terms of Service',
        incompatible_content_explanation: 'Content violates community guidelines',
        incompatible_content_illegal: 'No',
      }));
      expect(result.success).toBe(true);
    });

    it('accepts all decision types simultaneously', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_visibility: ['DECISION_VISIBILITY_CONTENT_REMOVED', 'DECISION_VISIBILITY_CONTENT_LABELLED'],
        decision_monetary: 'DECISION_MONETARY_SUSPENSION',
        decision_provision: 'DECISION_PROVISION_TOTAL_SUSPENSION',
        decision_account: 'DECISION_ACCOUNT_SUSPENDED',
        account_type: 'ACCOUNT_TYPE_BUSINESS',
      }));
      expect(result.success).toBe(true);
    });

    it('accepts multiple content types', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_type: ['CONTENT_TYPE_TEXT', 'CONTENT_TYPE_IMAGE', 'CONTENT_TYPE_VIDEO'],
      }));
      expect(result.success).toBe(true);
    });

    it('accepts territorial scope with EEA codes', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        territorial_scope: ['DE', 'AT', 'FR'],
      }));
      expect(result.success).toBe(true);
    });

    it('accepts content language as 2-char code', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_language: 'DE',
      }));
      expect(result.success).toBe(true);
    });

    it('accepts category addition and specification', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        category_addition: ['STATEMENT_CATEGORY_VIOLENCE'],
        category_specification: ['KEYWORD_HATE_SPEECH', 'KEYWORD_DISCRIMINATION'],
      }));
      expect(result.success).toBe(true);
    });

    it('accepts all source types', () => {
      for (const source of ['SOURCE_ARTICLE_16', 'SOURCE_TRUSTED_FLAGGER', 'SOURCE_TYPE_OTHER_NOTIFICATION', 'SOURCE_VOLUNTARY']) {
        const result = sorSubmissionSchema.safeParse(validPayload({ source_type: source }));
        expect(result.success).toBe(true);
      }
    });

    it('accepts all automated decision levels', () => {
      for (const level of ['AUTOMATED_DECISION_FULLY', 'AUTOMATED_DECISION_PARTIALLY', 'AUTOMATED_DECISION_NOT_AUTOMATED']) {
        const result = sorSubmissionSchema.safeParse(validPayload({ automated_decision: level }));
        expect(result.success).toBe(true);
      }
    });

    it('accepts end dates', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        end_date_visibility_restriction: '2025-06-15',
        end_date_monetary_restriction: '2025-06-15',
        end_date_service_restriction: '2025-06-15',
        end_date_account_restriction: '2025-06-15',
      }));
      expect(result.success).toBe(true);
    });

    it('accepts content_id with valid EAN-13', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_id: { 'EAN-13': '0123456789123' },
      }));
      expect(result.success).toBe(true);
    });

    it('accepts decision_account alone (without visibility)', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_visibility: undefined,
        decision_account: 'DECISION_ACCOUNT_SUSPENDED',
      }));
      expect(result.success).toBe(true);
    });

    it('accepts decision_monetary alone (without visibility)', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_visibility: undefined,
        decision_monetary: 'DECISION_MONETARY_TERMINATION',
      }));
      expect(result.success).toBe(true);
    });
  });

  describe('invalid payloads', () => {
    it('rejects when no decision type is provided', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_visibility: undefined,
      }));
      expect(result.success).toBe(false);
    });

    it('rejects empty decision_visibility array', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_visibility: [],
      }));
      expect(result.success).toBe(false);
    });

    it('rejects missing decision_ground', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_ground: undefined,
      }));
      expect(result.success).toBe(false);
    });

    it('rejects missing illegal_content_legal_ground when ground is ILLEGAL_CONTENT', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        illegal_content_legal_ground: undefined,
      }));
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path.join('.'));
        expect(paths).toContain('illegal_content_legal_ground');
      }
    });

    it('rejects missing incompatible fields when ground is INCOMPATIBLE_CONTENT', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_ground: 'DECISION_GROUND_INCOMPATIBLE_CONTENT',
        illegal_content_legal_ground: undefined,
        illegal_content_explanation: undefined,
      }));
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path.join('.'));
        expect(paths).toContain('incompatible_content_ground');
        expect(paths).toContain('incompatible_content_explanation');
      }
    });

    it('rejects empty content_type array', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_type: [],
      }));
      expect(result.success).toBe(false);
    });

    it('rejects missing category', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        category: undefined,
      }));
      expect(result.success).toBe(false);
    });

    it('rejects invalid PUID format', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        puid: 'invalid puid with spaces!',
      }));
      expect(result.success).toBe(false);
    });

    it('rejects empty PUID', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        puid: '',
      }));
      expect(result.success).toBe(false);
    });

    it('rejects invalid date format', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_date: '15/06/2024',
      }));
      expect(result.success).toBe(false);
    });

    it('rejects content_date before 2000-01-01', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_date: '1999-12-31',
      }));
      expect(result.success).toBe(false);
    });

    it('rejects application_date before 2020-01-01', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        application_date: '2019-12-31',
      }));
      expect(result.success).toBe(false);
    });

    it('rejects decision_facts exceeding 5000 characters', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_facts: 'x'.repeat(5001),
      }));
      expect(result.success).toBe(false);
    });

    it('rejects invalid enum values', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_ground: 'INVALID_GROUND',
      }));
      expect(result.success).toBe(false);
    });

    it('rejects missing visibility_other when OTHER selected', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_visibility: ['DECISION_VISIBILITY_OTHER'],
      }));
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path.join('.'));
        expect(paths).toContain('decision_visibility_other');
      }
    });

    it('rejects missing monetary_other when OTHER selected', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        decision_monetary: 'DECISION_MONETARY_OTHER',
      }));
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path.join('.'));
        expect(paths).toContain('decision_monetary_other');
      }
    });

    it('rejects missing content_type_other when OTHER selected', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_type: ['CONTENT_TYPE_OTHER'],
      }));
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map(i => i.path.join('.'));
        expect(paths).toContain('content_type_other');
      }
    });

    it('rejects invalid EAN-13 (wrong length)', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        content_id: { 'EAN-13': '123456' },
      }));
      expect(result.success).toBe(false);
    });

    it('rejects invalid territorial scope codes', () => {
      const result = sorSubmissionSchema.safeParse(validPayload({
        territorial_scope: ['XX'],
      }));
      expect(result.success).toBe(false);
    });
  });
});
