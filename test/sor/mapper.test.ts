import { describe, it, expect } from 'vitest';
import { createPlatformMapper } from '../../src/sor/mapper.js';
import { SoRBuilder } from '../../src/sor/builder.js';
import { Category, CategorySpecification } from '../../src/schemas/enums.js';

describe('Platform Mapper', () => {
  const mapper = createPlatformMapper({
    platformName: 'testapp',
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
        defaultExplanation: 'Violates terms of service on spam',
      },
      csam: {
        euCategory: Category.PROTECTION_OF_MINORS,
        euSpecifications: [CategorySpecification.CHILD_SEXUAL_ABUSE_MATERIAL],
        defaultGround: 'ILLEGAL_CONTENT',
        legalGround: '§184b StGB',
        defaultExplanation: 'Child sexual abuse material',
      },
    },
    defaultContentTypes: ['CONTENT_TYPE_TEXT'],
    defaultTerritorialScope: ['DE'],
  });

  it('maps hate_speech category to EU category + specifications', () => {
    const builder = new SoRBuilder();
    mapper(builder, 'hate_speech');
    const json = builder.toJSON();

    expect(json.category).toBe(Category.ILLEGAL_OR_HARMFUL_SPEECH);
    expect(json.category_specification).toContain(CategorySpecification.HATE_SPEECH);
    expect(json.category_specification).toContain(CategorySpecification.INCITEMENT_VIOLENCE_HATRED);
    expect(json.decision_ground).toBe('DECISION_GROUND_ILLEGAL_CONTENT');
    expect(json.illegal_content_legal_ground).toBe('§130 StGB');
  });

  it('maps incompatible content category (spam)', () => {
    const builder = new SoRBuilder();
    mapper(builder, 'spam');
    const json = builder.toJSON();

    expect(json.category).toBe(Category.SCAMS_AND_FRAUD);
    expect(json.decision_ground).toBe('DECISION_GROUND_INCOMPATIBLE_CONTENT');
    expect(json.incompatible_content_explanation).toBe('Violates terms of service on spam');
  });

  it('applies default content types', () => {
    const builder = new SoRBuilder();
    mapper(builder, 'hate_speech');
    const json = builder.toJSON();

    expect(json.content_type).toContain('CONTENT_TYPE_TEXT');
  });

  it('applies default territorial scope', () => {
    const builder = new SoRBuilder();
    mapper(builder, 'hate_speech');
    const json = builder.toJSON();

    expect(json.territorial_scope).toEqual(['DE']);
  });

  it('returns the builder for chaining', () => {
    const builder = new SoRBuilder();
    const result = mapper(builder, 'terrorism');
    expect(result).toBe(builder);
  });

  it('throws on unknown category', () => {
    const builder = new SoRBuilder();
    expect(() => mapper(builder, 'nonexistent' as any)).toThrow('Unknown platform category: nonexistent');
  });

  it('produces a valid SoR when combined with remaining fields', () => {
    const builder = new SoRBuilder();
    mapper(builder, 'csam');

    builder
      .contentRemoved()
      .puid('testapp-mod-001')
      .dates({ content: '2025-01-15', application: '2025-01-16' })
      .facts('CSAM content detected and removed.')
      .source('ARTICLE_16')
      .automatedDetection(true)
      .automatedDecision('NOT_AUTOMATED');

    const result = builder.build();
    expect(result.category).toBe(Category.PROTECTION_OF_MINORS);
    expect(result.puid).toBe('testapp-mod-001');
  });

  it('works without default content types or territorial scope', () => {
    const bareMapper = createPlatformMapper({
      platformName: 'bare',
      categories: {
        spam: {
          euCategory: Category.SCAMS_AND_FRAUD,
          defaultGround: 'INCOMPATIBLE_CONTENT',
        },
      },
    });

    const builder = new SoRBuilder();
    bareMapper(builder, 'spam');
    const json = builder.toJSON();

    expect(json.category).toBe(Category.SCAMS_AND_FRAUD);
    expect(json.content_type).toBeUndefined();
    expect(json.territorial_scope).toBeUndefined();
  });
});
