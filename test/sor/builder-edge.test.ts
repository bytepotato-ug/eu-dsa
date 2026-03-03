import { describe, it, expect } from 'vitest';
import { SoRBuilder } from '../../src/sor/builder.js';
import { DsaValidationError } from '../../src/api/errors.js';

describe('SoRBuilder edge cases', () => {
  function minimalBuilder() {
    return new SoRBuilder()
      .contentRemoved()
      .illegalContent('§130 StGB', 'Hate speech')
      .contentType('TEXT')
      .category('ILLEGAL_OR_HARMFUL_SPEECH')
      .dates({ content: '2024-06-15', application: '2024-06-16' })
      .facts('Content violated policies.')
      .source('ARTICLE_16')
      .automatedDetection(false)
      .automatedDecision('NOT_AUTOMATED')
      .puid('test-puid-1');
  }

  describe('contentId', () => {
    it('sets EAN-13', () => {
      const json = minimalBuilder().contentId('1234567890123').toJSON();
      expect(json.content_id).toEqual({ 'EAN-13': '1234567890123' });
    });
  });

  describe('accountType', () => {
    it('accepts shorthand key', () => {
      const json = minimalBuilder().accountType('BUSINESS').toJSON();
      expect(json.account_type).toBe('ACCOUNT_TYPE_BUSINESS');
    });

    it('accepts full enum value', () => {
      const json = minimalBuilder().accountType('ACCOUNT_TYPE_PRIVATE').toJSON();
      expect(json.account_type).toBe('ACCOUNT_TYPE_PRIVATE');
    });
  });

  describe('monetary', () => {
    it('accepts shorthand key', () => {
      const json = new SoRBuilder().monetary('SUSPENSION').toJSON();
      expect(json.decision_monetary).toBe('DECISION_MONETARY_SUSPENSION');
    });
  });

  describe('provision', () => {
    it('accepts shorthand key', () => {
      const json = new SoRBuilder().provision('TOTAL_TERMINATION').toJSON();
      expect(json.decision_provision).toBe('DECISION_PROVISION_TOTAL_TERMINATION');
    });
  });

  describe('endDates', () => {
    it('sets all end dates', () => {
      const json = minimalBuilder()
        .endDates({
          visibility: '2025-06-15',
          monetary: '2025-06-16',
          service: '2025-06-17',
          account: '2025-06-18',
        })
        .toJSON();
      expect(json.end_date_visibility_restriction).toBe('2025-06-15');
      expect(json.end_date_monetary_restriction).toBe('2025-06-16');
      expect(json.end_date_service_restriction).toBe('2025-06-17');
      expect(json.end_date_account_restriction).toBe('2025-06-18');
    });
  });

  describe('groundReferenceUrl', () => {
    it('sets reference URL', () => {
      const json = minimalBuilder().groundReferenceUrl('https://example.com/law').toJSON();
      expect(json.decision_ground_reference_url).toBe('https://example.com/law');
    });
  });

  describe('contentTypeOther', () => {
    it('sets content_type_other', () => {
      const json = minimalBuilder().contentTypeOther('VR content').toJSON();
      expect(json.content_type_other).toBe('VR content');
    });
  });

  describe('categorySpecificationOther', () => {
    it('sets category_specification_other', () => {
      const json = minimalBuilder().categorySpecificationOther('Custom spec').toJSON();
      expect(json.category_specification_other).toBe('Custom spec');
    });
  });

  describe('contentLanguage', () => {
    it('uppercases the language code', () => {
      const json = minimalBuilder().contentLanguage('de').toJSON();
      expect(json.content_language).toBe('DE');
    });
  });

  describe('validate', () => {
    it('returns valid: true for complete builder', () => {
      const result = minimalBuilder().validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('returns valid: false with errors for incomplete builder', () => {
      const result = new SoRBuilder().validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toBeTruthy();
    });
  });

  describe('reset', () => {
    it('clears all data', () => {
      const builder = minimalBuilder();
      builder.reset();
      expect(builder.toJSON()).toEqual({});
    });

    it('is chainable', () => {
      const builder = minimalBuilder();
      expect(builder.reset()).toBe(builder);
    });
  });

  describe('toJSON', () => {
    it('returns a copy (not a reference)', () => {
      const builder = minimalBuilder();
      const json1 = builder.toJSON();
      const json2 = builder.toJSON();
      expect(json1).toEqual(json2);
      expect(json1).not.toBe(json2);
    });
  });

  describe('visibilityOther', () => {
    it('builds valid submission with OTHER visibility', () => {
      const result = new SoRBuilder()
        .visibility('OTHER')
        .visibilityOther('Custom restriction')
        .illegalContent('§130 StGB', 'Hate speech')
        .contentType('TEXT')
        .category('ILLEGAL_OR_HARMFUL_SPEECH')
        .dates({ content: '2024-06-15', application: '2024-06-16' })
        .facts('Content violated policies.')
        .source('ARTICLE_16')
        .automatedDetection(false)
        .automatedDecision('NOT_AUTOMATED')
        .puid('other-vis-puid')
        .build();

      expect(result.decision_visibility_other).toBe('Custom restriction');
    });
  });

  describe('monetaryOther', () => {
    it('sets decision_monetary_other', () => {
      const json = new SoRBuilder().monetary('OTHER').monetaryOther('Custom monetary').toJSON();
      expect(json.decision_monetary).toBe('DECISION_MONETARY_OTHER');
      expect(json.decision_monetary_other).toBe('Custom monetary');
    });
  });

  describe('multiple visibility actions', () => {
    it('accumulates into array', () => {
      const json = new SoRBuilder()
        .contentRemoved()
        .contentLabelled()
        .toJSON();
      expect(json.decision_visibility).toHaveLength(2);
      expect(json.decision_visibility).toContain('DECISION_VISIBILITY_CONTENT_REMOVED');
      expect(json.decision_visibility).toContain('DECISION_VISIBILITY_CONTENT_LABELLED');
    });
  });

  describe('automatedDecision full enum value', () => {
    it('accepts AUTOMATED_DECISION_FULLY as string', () => {
      const json = new SoRBuilder().automatedDecision('AUTOMATED_DECISION_FULLY').toJSON();
      expect(json.automated_decision).toBe('AUTOMATED_DECISION_FULLY');
    });
  });

  describe('incompatibleContent with alsoIllegal', () => {
    it('sets incompatible_content_illegal to Yes', () => {
      const builder = new SoRBuilder();
      builder.incompatibleContent('Terms §3', 'Violates our terms', true);
      const json = builder.toJSON();
      expect(json.incompatible_content_illegal).toBe('Yes');
    });

    it('sets incompatible_content_illegal to No', () => {
      const builder = new SoRBuilder();
      builder.incompatibleContent('Terms §3', 'Violates our terms', false);
      const json = builder.toJSON();
      expect(json.incompatible_content_illegal).toBe('No');
    });
  });

  describe('build error includes field details', () => {
    it('throws DsaValidationError with field paths', () => {
      try {
        new SoRBuilder().build();
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DsaValidationError);
        const err = e as DsaValidationError;
        expect(Object.keys(err.fieldErrors).length).toBeGreaterThan(0);
      }
    });
  });
});
