/**
 * Platform category mapper — bridges platform-specific categories to EU API categories.
 */

import type { Category, CategorySpecification } from '../schemas/enums.js';
import { SoRBuilder } from './builder.js';

export interface CategoryMapping {
  euCategory: Category;
  euSpecifications?: CategorySpecification[];
  defaultGround: 'ILLEGAL_CONTENT' | 'INCOMPATIBLE_CONTENT';
  legalGround?: string;
  defaultExplanation?: string;
}

export interface PlatformMappingConfig<TCategory extends string = string> {
  platformName: string;
  categories: Record<TCategory, CategoryMapping>;
  defaultContentTypes?: string[];
  defaultTerritorialScope?: string[];
}

/**
 * Create a mapper function that pre-populates an SoRBuilder with platform-specific defaults.
 *
 * @example
 * ```ts
 * const mapper = createPlatformMapper({
 *   platformName: 'myapp',
 *   categories: {
 *     HATE_SPEECH: {
 *       euCategory: Category.ILLEGAL_OR_HARMFUL_SPEECH,
 *       euSpecifications: [CategorySpecification.HATE_SPEECH],
 *       defaultGround: 'ILLEGAL_CONTENT',
 *       legalGround: '§130 StGB',
 *     },
 *   },
 * });
 *
 * const builder = new SoRBuilder();
 * mapper(builder, 'HATE_SPEECH');
 * // Builder now has category, specification, and ground pre-filled
 * ```
 */
export function createPlatformMapper<TCategory extends string>(
  config: PlatformMappingConfig<TCategory>,
): (builder: SoRBuilder, category: TCategory) => SoRBuilder {
  return (builder: SoRBuilder, category: TCategory): SoRBuilder => {
    const mapping = config.categories[category];
    if (!mapping) {
      throw new Error(`Unknown platform category: ${category}. Available: ${Object.keys(config.categories).join(', ')}`);
    }

    builder.category(mapping.euCategory);

    if (mapping.euSpecifications?.length) {
      builder.categorySpecification(...mapping.euSpecifications);
    }

    if (mapping.defaultGround === 'ILLEGAL_CONTENT' && mapping.legalGround) {
      builder.illegalContent(mapping.legalGround, mapping.defaultExplanation ?? '');
    } else if (mapping.defaultGround === 'INCOMPATIBLE_CONTENT') {
      builder.incompatibleContent(mapping.legalGround ?? '', mapping.defaultExplanation ?? '');
    }

    if (config.defaultContentTypes?.length) {
      builder.contentType(...config.defaultContentTypes as never[]);
    }

    if (config.defaultTerritorialScope?.length) {
      builder.territorialScope(config.defaultTerritorialScope as never[]);
    }

    return builder;
  };
}
