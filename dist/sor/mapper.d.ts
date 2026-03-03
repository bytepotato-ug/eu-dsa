/**
 * Platform category mapper — bridges platform-specific categories to EU API categories.
 */
import type { Category, CategorySpecification, ContentType, TerritorialScopeCode } from '../schemas/enums.js';
import type { SoRBuilder } from './builder.js';
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
    defaultContentTypes?: ContentType[];
    defaultTerritorialScope?: TerritorialScopeCode[];
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
export declare function createPlatformMapper<TCategory extends string>(config: PlatformMappingConfig<TCategory>): (builder: SoRBuilder, category: TCategory) => SoRBuilder;
//# sourceMappingURL=mapper.d.ts.map