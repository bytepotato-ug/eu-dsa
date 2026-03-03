import { describe, it, expect } from 'vitest';
import { SoRBuilder } from '../../src/sor/builder.js';
import { DsaValidationError } from '../../src/api/errors.js';

function minimalBuilder() {
  return new SoRBuilder()
    .puid('test-puid-123')
    .contentRemoved()
    .illegalContent('§130 StGB', 'Incitement to hatred')
    .contentType('TEXT')
    .category('ILLEGAL_OR_HARMFUL_SPEECH')
    .dates({ content: '2024-06-15', application: '2024-06-16' })
    .facts('Content contained hate speech.')
    .source('ARTICLE_16')
    .automatedDetection(false)
    .automatedDecision('NOT_AUTOMATED')
    .territorialScope(['DE']);
}

describe('SoRBuilder', () => {
  describe('build()', () => {
    it('builds a valid SoR with minimal required fields', () => {
      const sor = minimalBuilder().build();
      expect(sor.puid).toBe('test-puid-123');
      expect(sor.decision_visibility).toContain('DECISION_VISIBILITY_CONTENT_REMOVED');
      expect(sor.decision_ground).toBe('DECISION_GROUND_ILLEGAL_CONTENT');
      expect(sor.content_type).toContain('CONTENT_TYPE_TEXT');
      expect(sor.category).toBe('STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH');
      expect(sor.automated_detection).toBe('No');
      expect(sor.automated_decision).toBe('AUTOMATED_DECISION_NOT_AUTOMATED');
    });

    it('throws DsaValidationError when required fields are missing', () => {
      expect(() => new SoRBuilder().build()).toThrow(DsaValidationError);
    });

    it('throws DsaValidationError with field-level errors', () => {
      try {
        new SoRBuilder().puid('test').build();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DsaValidationError);
        const validationError = error as DsaValidationError;
        expect(Object.keys(validationError.fieldErrors).length).toBeGreaterThan(0);
      }
    });
  });

  describe('decision shorthands', () => {
    it('contentRemoved() sets CONTENT_REMOVED', () => {
      const json = minimalBuilder().toJSON();
      expect(json.decision_visibility).toContain('DECISION_VISIBILITY_CONTENT_REMOVED');
    });

    it('contentDemoted() sets CONTENT_DEMOTED', () => {
      const json = new SoRBuilder().contentDemoted().toJSON();
      expect(json.decision_visibility).toContain('DECISION_VISIBILITY_CONTENT_DEMOTED');
    });

    it('contentLabelled() sets CONTENT_LABELLED', () => {
      const json = new SoRBuilder().contentLabelled().toJSON();
      expect(json.decision_visibility).toContain('DECISION_VISIBILITY_CONTENT_LABELLED');
    });

    it('accountSuspended() sets DECISION_ACCOUNT_SUSPENDED', () => {
      const json = new SoRBuilder().accountSuspended().toJSON();
      expect(json.decision_account).toBe('DECISION_ACCOUNT_SUSPENDED');
    });

    it('accountTerminated() sets DECISION_ACCOUNT_TERMINATED', () => {
      const json = new SoRBuilder().accountTerminated().toJSON();
      expect(json.decision_account).toBe('DECISION_ACCOUNT_TERMINATED');
    });
  });

  describe('decision grounds', () => {
    it('illegalContent() sets ground and required fields', () => {
      const json = new SoRBuilder()
        .illegalContent('§130 StGB', 'Incitement to hatred')
        .toJSON();
      expect(json.decision_ground).toBe('DECISION_GROUND_ILLEGAL_CONTENT');
      expect(json.illegal_content_legal_ground).toBe('§130 StGB');
      expect(json.illegal_content_explanation).toBe('Incitement to hatred');
    });

    it('incompatibleContent() sets ground and required fields', () => {
      const json = new SoRBuilder()
        .incompatibleContent('Section 3.2 TOS', 'Violates community guidelines', true)
        .toJSON();
      expect(json.decision_ground).toBe('DECISION_GROUND_INCOMPATIBLE_CONTENT');
      expect(json.incompatible_content_ground).toBe('Section 3.2 TOS');
      expect(json.incompatible_content_explanation).toBe('Violates community guidelines');
      expect(json.incompatible_content_illegal).toBe('Yes');
    });
  });

  describe('enum key resolution', () => {
    it('accepts shorthand keys for contentType', () => {
      const json = new SoRBuilder().contentType('TEXT', 'IMAGE').toJSON();
      expect(json.content_type).toContain('CONTENT_TYPE_TEXT');
      expect(json.content_type).toContain('CONTENT_TYPE_IMAGE');
    });

    it('accepts shorthand keys for category', () => {
      const json = new SoRBuilder().category('VIOLENCE').toJSON();
      expect(json.category).toBe('STATEMENT_CATEGORY_VIOLENCE');
    });

    it('accepts shorthand keys for source', () => {
      const json = new SoRBuilder().source('TRUSTED_FLAGGER', 'Example Org').toJSON();
      expect(json.source_type).toBe('SOURCE_TRUSTED_FLAGGER');
      expect(json.source_identity).toBe('Example Org');
    });

    it('accepts shorthand keys for automatedDecision', () => {
      const json = new SoRBuilder().automatedDecision('PARTIALLY').toJSON();
      expect(json.automated_decision).toBe('AUTOMATED_DECISION_PARTIALLY');
    });

    it('also accepts full enum values', () => {
      const json = new SoRBuilder().contentType('CONTENT_TYPE_VIDEO' as never).toJSON();
      expect(json.content_type).toContain('CONTENT_TYPE_VIDEO');
    });
  });

  describe('automatedDetection()', () => {
    it('true → "Yes"', () => {
      const json = new SoRBuilder().automatedDetection(true).toJSON();
      expect(json.automated_detection).toBe('Yes');
    });

    it('false → "No"', () => {
      const json = new SoRBuilder().automatedDetection(false).toJSON();
      expect(json.automated_detection).toBe('No');
    });
  });

  describe('contentLanguage()', () => {
    it('converts to uppercase', () => {
      const json = new SoRBuilder().contentLanguage('de').toJSON();
      expect(json.content_language).toBe('DE');
    });
  });

  describe('validate()', () => {
    it('returns valid: true for complete builder', () => {
      const result = minimalBuilder().validate();
      expect(result.valid).toBe(true);
    });

    it('returns valid: false with errors for incomplete builder', () => {
      const result = new SoRBuilder().validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('reset()', () => {
    it('clears all data', () => {
      const builder = minimalBuilder();
      builder.reset();
      const json = builder.toJSON();
      expect(Object.keys(json).length).toBe(0);
    });
  });

  describe('method chaining', () => {
    it('returns this for all setter methods', () => {
      const builder = new SoRBuilder();
      const result = builder
        .puid('test')
        .contentRemoved()
        .illegalContent('law', 'explanation')
        .contentType('TEXT')
        .category('VIOLENCE')
        .dates({ content: '2024-01-01', application: '2024-01-02' })
        .facts('facts')
        .source('VOLUNTARY')
        .automatedDetection(false)
        .automatedDecision('NOT_AUTOMATED')
        .territorialScope(['DE'])
        .contentLanguage('DE');
      expect(result).toBe(builder);
    });
  });

  describe('complex scenarios', () => {
    it('builds a comprehensive SoR with all optional fields', () => {
      const sor = new SoRBuilder()
        .puid('myplatform-mod-2024-001')
        .visibility('CONTENT_REMOVED', 'CONTENT_LABELLED')
        .monetary('SUSPENSION')
        .account('SUSPENDED')
        .accountType('PRIVATE')
        .illegalContent('§130 StGB', 'Incitement to hatred against ethnic minorities')
        .groundReferenceUrl('https://example.com/tos')
        .contentType('TEXT', 'IMAGE')
        .category('ILLEGAL_OR_HARMFUL_SPEECH')
        .categoryAddition('VIOLENCE')
        .categorySpecification('HATE_SPEECH', 'DISCRIMINATION')
        .dates({ content: '2024-06-15', application: '2024-06-16' })
        .endDates({ visibility: '2025-06-15', account: '2025-06-15' })
        .facts('Content contained explicit incitement to hatred against ethnic minorities, with violent imagery.')
        .source('TRUSTED_FLAGGER', 'National Anti-Discrimination Agency')
        .automatedDetection(true)
        .automatedDecision('PARTIALLY')
        .territorialScope(['DE', 'AT'])
        .contentLanguage('DE')
        .build();

      expect(sor.puid).toBe('myplatform-mod-2024-001');
      expect(sor.decision_visibility).toHaveLength(2);
      expect(sor.decision_monetary).toBe('DECISION_MONETARY_SUSPENSION');
      expect(sor.decision_account).toBe('DECISION_ACCOUNT_SUSPENDED');
      expect(sor.source_type).toBe('SOURCE_TRUSTED_FLAGGER');
      expect(sor.source_identity).toBe('National Anti-Discrimination Agency');
      expect(sor.territorial_scope).toContain('DE');
      expect(sor.territorial_scope).toContain('AT');
    });
  });
});
